import test from "node:test";
import assert from "node:assert/strict";

import {
  parseConntrackOutput,
  parseProcNetEnhanced,
  collectEnhancedNetworkSnapshot,
  type EnhancedNetworkEvent
} from "../../src/monitor/enhancedNetworkMonitor";
import type { CommandResult } from "../../src/monitor/networkMonitor";

// ---------------------------------------------------------------------------
// conntrack output parsing
// ---------------------------------------------------------------------------

test("parseConntrackOutput parses a TCP ESTABLISHED line with bytes counters", () => {
  const output =
    "tcp      6 431999 ESTABLISHED src=172.17.0.2 dst=93.184.216.34 sport=45678 dport=443 bytes=1234 src=93.184.216.34 dst=172.17.0.2 sport=443 dport=45678 bytes=5678 [ASSURED] mark=0 use=1";

  const events = parseConntrackOutput(output, "2026-04-11T10:00:00.000Z");

  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    timestamp: "2026-04-11T10:00:00.000Z",
    protocol: "tcp",
    srcAddr: "172.17.0.2",
    srcPort: 45678,
    dstAddr: "93.184.216.34",
    dstPort: 443,
    state: "ESTABLISHED",
    bytesOriginal: 1234,
    bytesReply: 5678
  });
});

test("parseConntrackOutput parses a UDP line without explicit state", () => {
  const output =
    "udp     17 30 src=172.17.0.2 dst=8.8.8.8 sport=12345 dport=53 bytes=100 src=8.8.8.8 dst=172.17.0.2 sport=53 dport=12345 bytes=200 mark=0 use=1";

  const events = parseConntrackOutput(output, "2026-04-11T10:00:00.000Z");

  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    timestamp: "2026-04-11T10:00:00.000Z",
    protocol: "udp",
    srcAddr: "172.17.0.2",
    srcPort: 12345,
    dstAddr: "8.8.8.8",
    dstPort: 53,
    state: "ACTIVE",
    bytesOriginal: 100,
    bytesReply: 200
  });
});

test("parseConntrackOutput parses multiple lines and ignores blank/comment lines", () => {
  const output = [
    "tcp      6 100 TIME_WAIT src=10.0.0.5 dst=1.1.1.1 sport=50000 dport=80 src=1.1.1.1 dst=10.0.0.5 sport=80 dport=50000 [ASSURED] mark=0 use=1",
    "",
    "# this is a comment",
    "udp     17 25 src=10.0.0.5 dst=8.8.4.4 sport=11111 dport=53 bytes=64 src=8.8.4.4 dst=10.0.0.5 sport=53 dport=11111 bytes=128 mark=0 use=1"
  ].join("\n");

  const events = parseConntrackOutput(output, "2026-04-11T10:00:00.000Z");

  assert.equal(events.length, 2);
  assert.equal(events[0].protocol, "tcp");
  assert.equal(events[0].state, "TIME_WAIT");
  assert.equal(events[0].dstAddr, "1.1.1.1");
  assert.equal(events[1].protocol, "udp");
  assert.equal(events[1].dstAddr, "8.8.4.4");
});

test("parseConntrackOutput ignores lines with unrecognized protocols", () => {
  const output = "icmp     1 30 src=10.0.0.5 dst=8.8.8.8 type=8 code=0 id=12345";

  const events = parseConntrackOutput(output, "2026-04-11T10:00:00.000Z");

  assert.equal(events.length, 0);
});

test("parseConntrackOutput returns empty array for empty input", () => {
  assert.deepEqual(parseConntrackOutput("", "2026-04-11T10:00:00.000Z"), []);
  assert.deepEqual(parseConntrackOutput("\n\n", "2026-04-11T10:00:00.000Z"), []);
});

test("parseConntrackOutput handles lines without bytes counters", () => {
  const output =
    "tcp      6 100 ESTABLISHED src=172.17.0.2 dst=10.0.0.1 sport=5000 dport=80 src=10.0.0.1 dst=172.17.0.2 sport=80 dport=5000 [ASSURED] mark=0 use=1";

  const events = parseConntrackOutput(output, "2026-04-11T10:00:00.000Z");

  assert.equal(events.length, 1);
  assert.equal(events[0].bytesOriginal, undefined);
  assert.equal(events[0].bytesReply, undefined);
});

// ---------------------------------------------------------------------------
// /proc/net/tcp + /proc/net/udp enhanced parsing
// ---------------------------------------------------------------------------

test("parseProcNetEnhanced parses TCP connections from /proc/net/tcp", () => {
  const tcpOutput = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:C350 0A7100CB:01BB 01 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
`;

  const events = parseProcNetEnhanced(tcpOutput, "", "2026-04-11T10:00:00.000Z");

  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    timestamp: "2026-04-11T10:00:00.000Z",
    protocol: "tcp",
    srcAddr: "127.0.0.1",
    srcPort: 50000,
    dstAddr: "203.0.113.10",
    dstPort: 443,
    state: "ESTABLISHED"
  });
});

test("parseProcNetEnhanced parses UDP connections from /proc/net/udp", () => {
  const udpOutput = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:3039 08080808:0035 07 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
`;

  const events = parseProcNetEnhanced("", udpOutput, "2026-04-11T10:00:00.000Z");

  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    timestamp: "2026-04-11T10:00:00.000Z",
    protocol: "udp",
    srcAddr: "127.0.0.1",
    srcPort: 12345,
    dstAddr: "8.8.8.8",
    dstPort: 53,
    state: "ACTIVE"
  });
});

test("parseProcNetEnhanced combines TCP and UDP events", () => {
  const tcpOutput = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:C350 0A7100CB:01BB 01 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
`;
  const udpOutput = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:3039 08080808:0035 07 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
`;

  const events = parseProcNetEnhanced(tcpOutput, udpOutput, "2026-04-11T10:00:00.000Z");

  assert.equal(events.length, 2);
  assert.equal(events[0].protocol, "tcp");
  assert.equal(events[1].protocol, "udp");
});

test("parseProcNetEnhanced skips LISTEN state entries", () => {
  const tcpOutput = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
`;

  const events = parseProcNetEnhanced(tcpOutput, "", "2026-04-11T10:00:00.000Z");

  assert.equal(events.length, 0);
});

test("parseProcNetEnhanced skips connections to the audit port (8080)", () => {
  // 1F90 hex = 8080 decimal
  const tcpOutput = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:1F90 0141A8C0:D8B4 01 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
`;

  const events = parseProcNetEnhanced(tcpOutput, "", "2026-04-11T10:00:00.000Z");

  assert.equal(events.length, 0);
});

test("parseProcNetEnhanced skips connections to 0.0.0.0 destinations", () => {
  const tcpOutput = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:C350 00000000:01BB 01 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
`;

  const events = parseProcNetEnhanced(tcpOutput, "", "2026-04-11T10:00:00.000Z");

  assert.equal(events.length, 0);
});

test("parseProcNetEnhanced returns empty array when both inputs are empty", () => {
  const events = parseProcNetEnhanced("", "", "2026-04-11T10:00:00.000Z");
  assert.deepEqual(events, []);
});

// ---------------------------------------------------------------------------
// collectEnhancedNetworkSnapshot — conntrack path
// ---------------------------------------------------------------------------

test("collectEnhancedNetworkSnapshot uses conntrack when available", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];

  const commandRunner = async (
    command: string,
    args: string[]
  ): Promise<CommandResult> => {
    calls.push({ command, args });

    if (command === "which" && args[0] === "conntrack") {
      return { stdout: "/usr/sbin/conntrack\n", stderr: "", exitCode: 0 };
    }

    if (command === "docker" && args[0] === "inspect") {
      return { stdout: "42\n", stderr: "", exitCode: 0 };
    }

    if (command === "nsenter") {
      return {
        stdout:
          "tcp      6 100 ESTABLISHED src=172.17.0.2 dst=93.184.216.34 sport=45678 dport=443 bytes=500 src=93.184.216.34 dst=172.17.0.2 sport=443 dport=45678 bytes=1000 [ASSURED] mark=0 use=1\n",
        stderr: "",
        exitCode: 0
      };
    }

    return { stdout: "", stderr: "not found", exitCode: 1 };
  };

  const snapshot = await collectEnhancedNetworkSnapshot("ctr-1", {
    commandRunner,
    now: () => new Date("2026-04-11T10:00:00.000Z")
  });

  assert.equal(snapshot.source, "conntrack");
  assert.equal(snapshot.events.length, 1);
  assert.equal(snapshot.events[0].dstAddr, "93.184.216.34");
  assert.equal(snapshot.events[0].bytesOriginal, 500);
  assert.equal(snapshot.events[0].bytesReply, 1000);
  assert.equal(snapshot.events[0].containerPid, 42);
});

// ---------------------------------------------------------------------------
// collectEnhancedNetworkSnapshot — procfs fallback
// ---------------------------------------------------------------------------

test("collectEnhancedNetworkSnapshot falls back to procfs when conntrack is unavailable", async () => {
  const commandRunner = async (
    command: string,
    args: string[]
  ): Promise<CommandResult> => {
    if (command === "which") {
      return { stdout: "", stderr: "not found", exitCode: 1 };
    }

    if (command === "docker" && args[1] === "ctr-2" && args[2] === "cat") {
      const file = args[3];

      if (file === "/proc/net/tcp") {
        return {
          stdout: `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:C350 0A7100CB:01BB 01 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
`,
          stderr: "",
          exitCode: 0
        };
      }

      if (file === "/proc/net/udp") {
        return {
          stdout: `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:3039 08080808:0035 07 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
`,
          stderr: "",
          exitCode: 0
        };
      }
    }

    return { stdout: "", stderr: "not found", exitCode: 1 };
  };

  const snapshot = await collectEnhancedNetworkSnapshot("ctr-2", {
    commandRunner,
    now: () => new Date("2026-04-11T10:00:00.000Z")
  });

  assert.equal(snapshot.source, "procfs+udp");
  assert.equal(snapshot.events.length, 2);

  const tcp = snapshot.events.find((e) => e.protocol === "tcp");
  const udp = snapshot.events.find((e) => e.protocol === "udp");

  assert.ok(tcp);
  assert.equal(tcp.dstAddr, "203.0.113.10");
  assert.equal(tcp.state, "ESTABLISHED");

  assert.ok(udp);
  assert.equal(udp.dstAddr, "8.8.8.8");
  assert.equal(udp.dstPort, 53);
  assert.equal(udp.state, "ACTIVE");
});

test("collectEnhancedNetworkSnapshot falls back to procfs (tcp-only) when UDP file is missing", async () => {
  const commandRunner = async (
    command: string,
    args: string[]
  ): Promise<CommandResult> => {
    if (command === "which") {
      return { stdout: "", stderr: "not found", exitCode: 1 };
    }

    if (command === "docker" && args[2] === "cat") {
      const file = args[3];

      if (file === "/proc/net/tcp") {
        return {
          stdout: `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:C350 0A7100CB:01BB 06 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
`,
          stderr: "",
          exitCode: 0
        };
      }

      if (file === "/proc/net/udp") {
        return { stdout: "", stderr: "No such file", exitCode: 1 };
      }
    }

    return { stdout: "", stderr: "not found", exitCode: 1 };
  };

  const snapshot = await collectEnhancedNetworkSnapshot("ctr-3", {
    commandRunner,
    now: () => new Date("2026-04-11T10:00:00.000Z")
  });

  assert.equal(snapshot.source, "procfs");
  assert.equal(snapshot.events.length, 1);
  assert.equal(snapshot.events[0].protocol, "tcp");
  assert.equal(snapshot.events[0].state, "TIME_WAIT");
});

// ---------------------------------------------------------------------------
// collectEnhancedNetworkSnapshot — conntrack available but nsenter fails
// ---------------------------------------------------------------------------

test("collectEnhancedNetworkSnapshot falls back to procfs when conntrack exists but nsenter fails", async () => {
  const commandRunner = async (
    command: string,
    args: string[]
  ): Promise<CommandResult> => {
    if (command === "which" && args[0] === "conntrack") {
      return { stdout: "/usr/sbin/conntrack\n", stderr: "", exitCode: 0 };
    }

    if (command === "docker" && args[0] === "inspect") {
      return { stdout: "42\n", stderr: "", exitCode: 0 };
    }

    if (command === "nsenter") {
      return { stdout: "", stderr: "permission denied", exitCode: 1 };
    }

    if (command === "docker" && args[2] === "cat") {
      const file = args[3];

      if (file === "/proc/net/tcp") {
        return {
          stdout: `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:C350 0A7100CB:01BB 01 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
`,
          stderr: "",
          exitCode: 0
        };
      }

      if (file === "/proc/net/udp") {
        return { stdout: "", stderr: "", exitCode: 1 };
      }
    }

    return { stdout: "", stderr: "", exitCode: 1 };
  };

  const snapshot = await collectEnhancedNetworkSnapshot("ctr-4", {
    commandRunner,
    now: () => new Date("2026-04-11T10:00:00.000Z")
  });

  assert.equal(snapshot.source, "procfs");
  assert.equal(snapshot.events.length, 1);
  assert.equal(snapshot.events[0].protocol, "tcp");
});
