import { PORT } from "../config/constants";
import type { CommandRunner, CommandResult } from "./networkMonitor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnhancedNetworkEvent {
  timestamp: string;
  protocol: "tcp" | "udp";
  srcAddr: string;
  srcPort: number;
  dstAddr: string;
  dstPort: number;
  state: string;
  bytesOriginal?: number;
  bytesReply?: number;
  containerPid?: number;
}

export interface EnhancedNetworkSnapshot {
  source: "conntrack" | "procfs" | "procfs+udp";
  events: EnhancedNetworkEvent[];
}

export type EnhancedSnapshotProvider = (
  containerId: string
) => Promise<EnhancedNetworkSnapshot>;

// ---------------------------------------------------------------------------
// conntrack output parser
// ---------------------------------------------------------------------------

/**
 * Parse a single line of `conntrack -L` output.
 *
 * Example lines:
 *   tcp      6 431999 ESTABLISHED src=172.17.0.2 dst=93.184.216.34 sport=45678 dport=443 bytes=1234 ...
 *   udp     17 30 src=172.17.0.2 dst=8.8.8.8 sport=12345 dport=53 bytes=100 ...
 */
function parseConntrackLine(
  line: string,
  timestamp: string
): EnhancedNetworkEvent | undefined {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return undefined;
  }

  const protocolMatch = trimmed.match(/^(tcp|udp)\s+/);

  if (!protocolMatch) {
    return undefined;
  }

  const protocol = protocolMatch[1] as "tcp" | "udp";

  // Extract state (TCP only; UDP lines may lack it)
  const stateMatch = trimmed.match(/\b(ESTABLISHED|SYN_SENT|SYN_RECV|FIN_WAIT1|FIN_WAIT2|TIME_WAIT|CLOSE|CLOSE_WAIT|LAST_ACK|LISTEN|CLOSING)\b/);
  const state = stateMatch ? stateMatch[1] : protocol === "udp" ? "ACTIVE" : "UNKNOWN";

  // Extract first occurrence of src/dst/sport/dport (original direction)
  const srcMatch = trimmed.match(/\bsrc=(\S+)/);
  const dstMatch = trimmed.match(/\bdst=(\S+)/);
  const sportMatch = trimmed.match(/\bsport=(\d+)/);
  const dportMatch = trimmed.match(/\bdport=(\d+)/);

  if (!srcMatch || !dstMatch || !sportMatch || !dportMatch) {
    return undefined;
  }

  // Extract bytes counters (may appear twice — original then reply)
  const bytesMatches = [...trimmed.matchAll(/\bbytes=(\d+)/g)];
  const bytesOriginal =
    bytesMatches.length >= 1
      ? Number.parseInt(bytesMatches[0][1], 10)
      : undefined;
  const bytesReply =
    bytesMatches.length >= 2
      ? Number.parseInt(bytesMatches[1][1], 10)
      : undefined;

  return {
    timestamp,
    protocol,
    srcAddr: srcMatch[1],
    srcPort: Number.parseInt(sportMatch[1], 10),
    dstAddr: dstMatch[1],
    dstPort: Number.parseInt(dportMatch[1], 10),
    state,
    ...(bytesOriginal !== undefined ? { bytesOriginal } : {}),
    ...(bytesReply !== undefined ? { bytesReply } : {})
  };
}

export function parseConntrackOutput(
  output: string,
  timestamp: string
): EnhancedNetworkEvent[] {
  const events: EnhancedNetworkEvent[] = [];

  for (const line of output.split("\n")) {
    const event = parseConntrackLine(line, timestamp);

    if (event) {
      events.push(event);
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// /proc/net/tcp + /proc/net/udp parser (enhanced)
// ---------------------------------------------------------------------------

const TCP_STATE_MAP: Readonly<Record<string, string>> = {
  "01": "ESTABLISHED",
  "02": "SYN_SENT",
  "03": "SYN_RECV",
  "04": "FIN_WAIT1",
  "05": "FIN_WAIT2",
  "06": "TIME_WAIT",
  "07": "CLOSE",
  "08": "CLOSE_WAIT",
  "09": "LAST_ACK",
  "0A": "LISTEN",
  "0B": "CLOSING"
};

function parseIpv4Hex(hex: string): string {
  const octets = hex.match(/../g);

  if (!octets || octets.length !== 4) {
    throw new Error("Unexpected IPv4 hex length in /proc/net output");
  }

  return octets
    .reverse()
    .map((octet) => Number.parseInt(octet, 16))
    .join(".");
}

function parseProcAddress(address: string): { ip: string; port: number } | undefined {
  const [hexAddr, hexPort] = address.split(":");

  if (!hexAddr || !hexPort) {
    return undefined;
  }

  if (hexAddr.length !== 8) {
    return undefined;
  }

  const ip = parseIpv4Hex(hexAddr);
  const port = Number.parseInt(hexPort, 16);

  return { ip, port };
}

export function parseProcNetEnhanced(
  tcpOutput: string,
  udpOutput: string,
  timestamp: string
): EnhancedNetworkEvent[] {
  const events: EnhancedNetworkEvent[] = [];

  const parseProcLines = (
    text: string,
    protocol: "tcp" | "udp"
  ): void => {
    for (const line of text.split("\n")) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("sl") || trimmed.startsWith("local_address")) {
        continue;
      }

      const columns = trimmed.split(/\s+/);
      const localCol = columns[1];
      const remoteCol = columns[2];
      const stateCol = columns[3];

      if (!localCol || !remoteCol || !stateCol) {
        continue;
      }

      // Skip LISTEN state
      if (stateCol === "0A") {
        continue;
      }

      const local = parseProcAddress(localCol);
      const remote = parseProcAddress(remoteCol);

      if (!local || !remote) {
        continue;
      }

      // Skip connections to the audit port
      if (local.port === PORT) {
        continue;
      }

      // Skip 0.0.0.0 destinations
      if (remote.ip === "0.0.0.0") {
        continue;
      }

      const state =
        protocol === "tcp"
          ? TCP_STATE_MAP[stateCol] ?? `UNKNOWN_${stateCol}`
          : "ACTIVE";

      events.push({
        timestamp,
        protocol,
        srcAddr: local.ip,
        srcPort: local.port,
        dstAddr: remote.ip,
        dstPort: remote.port,
        state
      });
    }
  };

  parseProcLines(tcpOutput, "tcp");
  parseProcLines(udpOutput, "udp");

  return events;
}

// ---------------------------------------------------------------------------
// Snapshot collectors
// ---------------------------------------------------------------------------

async function collectViaConntrack(
  containerId: string,
  commandRunner: CommandRunner,
  timestamp: string
): Promise<EnhancedNetworkSnapshot | undefined> {
  // First check if conntrack is available on the host
  const check = await commandRunner("which", ["conntrack"]);

  if (check.exitCode !== 0) {
    return undefined;
  }

  // Get the container's network namespace PID
  const pidResult = await commandRunner("docker", [
    "inspect",
    "--format",
    "{{.State.Pid}}",
    containerId
  ]);

  if (pidResult.exitCode !== 0 || !pidResult.stdout.trim()) {
    return undefined;
  }

  const containerPid = Number.parseInt(pidResult.stdout.trim(), 10);

  if (Number.isNaN(containerPid) || containerPid <= 0) {
    return undefined;
  }

  // Use nsenter to run conntrack in the container's network namespace
  const conntrackResult = await commandRunner("nsenter", [
    "-t",
    String(containerPid),
    "-n",
    "conntrack",
    "-L"
  ]);

  if (conntrackResult.exitCode !== 0) {
    return undefined;
  }

  const events = parseConntrackOutput(conntrackResult.stdout, timestamp).map(
    (event) => ({ ...event, containerPid })
  );

  return { source: "conntrack", events };
}

async function collectViaProcfs(
  containerId: string,
  commandRunner: CommandRunner,
  timestamp: string
): Promise<EnhancedNetworkSnapshot> {
  // Try TCP + UDP together
  const tcpResult = await commandRunner("docker", [
    "exec",
    containerId,
    "cat",
    "/proc/net/tcp"
  ]);

  const udpResult = await commandRunner("docker", [
    "exec",
    containerId,
    "cat",
    "/proc/net/udp"
  ]);

  const tcpOutput = tcpResult.exitCode === 0 ? tcpResult.stdout : "";
  const udpOutput = udpResult.exitCode === 0 ? udpResult.stdout : "";

  const hasUdp = udpOutput.trim().length > 0;
  const events = parseProcNetEnhanced(tcpOutput, udpOutput, timestamp);

  return {
    source: hasUdp ? "procfs+udp" : "procfs",
    events
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function collectEnhancedNetworkSnapshot(
  containerId: string,
  options: {
    commandRunner?: CommandRunner;
    now?: () => Date;
  } = {}
): Promise<EnhancedNetworkSnapshot> {
  const commandRunner = options.commandRunner ?? defaultCommandRunner();
  const timestamp = (options.now ?? (() => new Date()))().toISOString();

  // Strategy 1: conntrack (most precise — includes bytes, both protocols)
  const conntrackSnapshot = await collectViaConntrack(
    containerId,
    commandRunner,
    timestamp
  );

  if (conntrackSnapshot) {
    return conntrackSnapshot;
  }

  // Strategy 2: Enhanced /proc/net (tcp + udp)
  return collectViaProcfs(containerId, commandRunner, timestamp);
}

// ---------------------------------------------------------------------------
// Default command runner (duplicated to avoid circular dependency;
// kept minimal and private)
// ---------------------------------------------------------------------------

function defaultCommandRunner(): CommandRunner {
  // Lazy-import to avoid top-level side effects
  const { execFile } = require("node:child_process");
  const { promisify } = require("node:util");
  const execFileAsync = promisify(execFile);

  return async (command: string, args: string[]): Promise<CommandResult> => {
    try {
      const result = await execFileAsync(command, args, { encoding: "utf8" });
      return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
    } catch (error) {
      const err = error as Error & {
        stdout?: string;
        stderr?: string;
        code?: number;
      };
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? err.message,
        exitCode: err.code ?? 1
      };
    }
  };
}
