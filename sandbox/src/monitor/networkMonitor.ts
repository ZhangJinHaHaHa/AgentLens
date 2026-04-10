import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { PORT } from "../config/constants";
import type { NetworkConnectionEvidence, NetworkEvidence } from "../types/manifest";

export interface NetworkActivity {
  requestedIps: string[];
  requestedHosts: string[];
  requestCount: number;
  networkEvidence?: NetworkEvidence;
}

export interface NetworkSnapshot {
  requestedIps: string[];
  requestedHosts?: string[];
  connections?: NetworkConnectionEvidence[];
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;
export type NetworkSnapshotProvider = (containerId: string) => Promise<NetworkSnapshot>;

const execFileAsync = promisify(execFile);

async function defaultCommandRunner(command: string, args: string[]): Promise<CommandResult> {
  try {
    const result = await execFileAsync(command, args, { encoding: "utf8" });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0
    };
  } catch (error) {
    const commandError = error as Error & { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: commandError.stdout ?? "",
      stderr: commandError.stderr ?? commandError.message,
      exitCode: commandError.code ?? 1
    };
  }
}

function parseIpv4Hex(hex: string): string {
  const octets = hex.match(/../g);

  if (!octets || octets.length !== 4) {
    throw new Error("Unexpected IPv4 hex length in /proc/net/tcp output");
  }

  return octets
    .reverse()
    .map((octet) => Number.parseInt(octet, 16))
    .join(".");
}

function parseProcNetAddress(address: string): string | undefined {
  const [hexAddress] = address.split(":");

  if (!hexAddress) {
    return undefined;
  }

  if (hexAddress.length === 8) {
    const ip = parseIpv4Hex(hexAddress);
    return ip === "0.0.0.0" ? undefined : ip;
  }

  return undefined;
}

function parseProcNetPort(address: string): number | undefined {
  const [, hexPort] = address.split(":");

  if (!hexPort) {
    return undefined;
  }

  return Number.parseInt(hexPort, 16);
}

function parseTcpState(state: string): string {
  const tcpStateMap: Record<string, string> = {
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

  return tcpStateMap[state] ?? `UNKNOWN_${state}`;
}

export function parseProcNetSnapshot(snapshotText: string): NetworkSnapshot {
  const requestedIps: string[] = [];
  const connections: NetworkConnectionEvidence[] = [];

  for (const line of snapshotText.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("sl") || trimmed.startsWith("local_address")) {
      continue;
    }

    const columns = trimmed.split(/\s+/);
    const localAddress = columns[1];
    const remoteAddress = columns[2];
    const state = columns[3];

    if (!localAddress || !remoteAddress || !state || state === "0A") {
      continue;
    }

    if (parseProcNetPort(localAddress) === PORT) {
      continue;
    }

    const ip = parseProcNetAddress(remoteAddress);
    const remotePort = parseProcNetPort(remoteAddress);

    if (ip && remotePort !== undefined) {
      requestedIps.push(ip);
      connections.push({
        protocol: "tcp4",
        remoteIp: ip,
        remotePort,
        state: parseTcpState(state)
      });
    }
  }

  return {
    requestedIps,
    requestedHosts: [],
    ...(connections.length > 0 ? { connections } : {})
  };
}

async function defaultSnapshotProvider(
  containerId: string,
  commandRunner: CommandRunner
): Promise<NetworkSnapshot> {
  const result = await commandRunner("docker", [
    "exec",
    containerId,
    "cat",
    "/proc/net/tcp",
    "/proc/net/tcp6"
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to collect container network snapshot: ${result.stderr || result.stdout}`);
  }

  return parseProcNetSnapshot(result.stdout);
}

export async function collectNetworkActivity(
  containerId: string,
  options: {
    snapshotProvider?: NetworkSnapshotProvider;
    commandRunner?: CommandRunner;
    now?: () => Date;
  } = {}
): Promise<NetworkActivity> {
  const commandRunner = options.commandRunner ?? defaultCommandRunner;
  const snapshotProvider =
    options.snapshotProvider ?? ((currentContainerId: string) => defaultSnapshotProvider(currentContainerId, commandRunner));
  const snapshots = await snapshotProvider(containerId);
  const networkEvidence =
    snapshots.connections && snapshots.connections.length > 0
      ? {
          source: "procfs" as const,
          observedAt: (options.now ?? (() => new Date()))().toISOString(),
          connections: snapshots.connections
        }
      : undefined;

  return {
    requestedIps: [...new Set(snapshots.requestedIps)].sort(),
    requestedHosts: [...new Set(snapshots.requestedHosts ?? [])].sort(),
    requestCount: snapshots.requestedIps.length,
    ...(networkEvidence ? { networkEvidence } : {})
  };
}
