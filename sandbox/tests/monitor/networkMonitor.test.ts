import test from "node:test";
import assert from "node:assert/strict";

import {
  collectNetworkActivity,
  parseProcNetSnapshot,
  type CommandRunner,
  type NetworkSnapshotProvider
} from "../../src/monitor/networkMonitor";
import {
  buildEgressPolicy,
  evaluateActionConsistency,
  evaluateNetworkActivity
} from "../../src/network/egressPolicy";

test("collectNetworkActivity deduplicates IPs and returns request count", async () => {
  const snapshotProvider: NetworkSnapshotProvider = async (containerId) => {
    assert.equal(containerId, "container-123");
    return {
      requestedIps: ["203.0.113.10", "203.0.113.10", "198.51.100.7"],
      requestedHosts: ["api.risk.com", "api.risk.com", "rpc.edge.local"]
    };
  };

  const activity = await collectNetworkActivity("container-123", { snapshotProvider });

  assert.deepEqual(activity, {
    requestedIps: ["198.51.100.7", "203.0.113.10"],
    requestedHosts: ["api.risk.com", "rpc.edge.local"],
    requestCount: 3
  });
});

test("parseProcNetSnapshot extracts remote IPv4 addresses from /proc/net/tcp output", () => {
  const snapshot = parseProcNetSnapshot(`  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:C350 0A7100CB:01BB 01 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
   1: 00000000:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000   100        0 2 0000000000000000 20 4 31 10 -1
   2: 0100007F:C351 076433C6:01BB 06 00000000:00000000 00:00000000 00000000   100        0 3 0000000000000000 20 4 31 10 -1
`);

  assert.deepEqual(snapshot, {
    requestedIps: ["203.0.113.10", "198.51.100.7"],
    requestedHosts: [],
    connections: [
      {
        protocol: "tcp4",
        remoteIp: "203.0.113.10",
        remotePort: 443,
        state: "ESTABLISHED"
      },
      {
        protocol: "tcp4",
        remoteIp: "198.51.100.7",
        remotePort: 443,
        state: "TIME_WAIT"
      }
    ]
  });
});

test("parseProcNetSnapshot ignores inbound connections that target the fixed audit port", () => {
  const snapshot = parseProcNetSnapshot(`  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:1F90 0141A8C0:D8B4 01 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
   1: 0100007F:C350 01010101:0050 01 00000000:00000000 00:00000000 00000000   100        0 2 0000000000000000 20 4 31 10 -1
`);

  assert.deepEqual(snapshot, {
    requestedIps: ["1.1.1.1"],
    requestedHosts: [],
    connections: [
      {
        protocol: "tcp4",
        remoteIp: "1.1.1.1",
        remotePort: 80,
        state: "ESTABLISHED"
      }
    ]
  });
});

test("collectNetworkActivity reads /proc/net/tcp data through docker exec by default", async () => {
  const commandRunner: CommandRunner = async (command, args) => {
    assert.equal(command, "docker");
    assert.deepEqual(args, ["exec", "container-123", "cat", "/proc/net/tcp", "/proc/net/tcp6"]);

    return {
      stdout: `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:C350 0A7100CB:01BB 01 00000000:00000000 00:00000000 00000000   100        0 1 0000000000000000 20 4 31 10 -1
   1: 0100007F:C351 0A7100CB:01BB 06 00000000:00000000 00:00000000 00000000   100        0 2 0000000000000000 20 4 31 10 -1
`,
      stderr: "",
      exitCode: 0
    };
  };

  const activity = await collectNetworkActivity("container-123", {
    commandRunner,
    now: () => new Date("2026-03-28T10:00:00.000Z")
  });

  assert.deepEqual(activity, {
    requestedIps: ["203.0.113.10"],
    requestedHosts: [],
    requestCount: 2,
    networkEvidence: {
      source: "procfs",
      observedAt: "2026-03-28T10:00:00.000Z",
      connections: [
        {
          protocol: "tcp4",
          remoteIp: "203.0.113.10",
          remotePort: 443,
          state: "ESTABLISHED"
        },
        {
          protocol: "tcp4",
          remoteIp: "203.0.113.10",
          remotePort: 443,
          state: "TIME_WAIT"
        }
      ]
    }
  });
});

test("collectNetworkActivity preserves structured procfs connection evidence", async () => {
  const snapshotProvider: NetworkSnapshotProvider = async () => ({
    requestedIps: ["203.0.113.10", "203.0.113.10"],
    requestedHosts: [],
    connections: [
      {
        protocol: "tcp4",
        remoteIp: "203.0.113.10",
        remotePort: 443,
        state: "ESTABLISHED"
      },
      {
        protocol: "tcp4",
        remoteIp: "203.0.113.10",
        remotePort: 443,
        state: "TIME_WAIT"
      }
    ]
  });

  const activity = await collectNetworkActivity("container-123", {
    snapshotProvider,
    now: () => new Date("2026-03-28T10:00:00.000Z")
  });

  assert.deepEqual(activity.networkEvidence, {
    source: "procfs",
    observedAt: "2026-03-28T10:00:00.000Z",
    connections: [
      {
        protocol: "tcp4",
        remoteIp: "203.0.113.10",
        remotePort: 443,
        state: "ESTABLISHED"
      },
      {
        protocol: "tcp4",
        remoteIp: "203.0.113.10",
        remotePort: 443,
        state: "TIME_WAIT"
      }
    ]
  });
});

test("evaluateNetworkActivity returns UNDECLARED_EGRESS when a host is outside the manifest policy", () => {
  const policy = buildEgressPolicy({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  const result = evaluateNetworkActivity(
    {
      requestedIps: ["203.0.113.10"],
      requestedHosts: ["malicious.example"],
      requestCount: 1
    },
    policy
  );

  assert.equal(result.reasonCode, "UNDECLARED_EGRESS");
});

test("evaluateNetworkActivity returns FORBIDDEN_IP_ACCESS when a blocked CIDR is observed", () => {
  const policy = buildEgressPolicy({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  const result = evaluateNetworkActivity(
    {
      requestedIps: ["127.0.0.1"],
      requestedHosts: ["api.risk.com"],
      requestCount: 1
    },
    policy
  );

  assert.equal(result.reasonCode, "FORBIDDEN_IP_ACCESS");
});

test("evaluateActionConsistency returns ACTION_MISMATCH when observed hosts differ from declared actions", () => {
  const result = evaluateActionConsistency(
    [
      {
        type: "web_request",
        url: "https://api.risk.com/v1/alert"
      }
    ],
    {
      requestedIps: ["203.0.113.10"],
      requestedHosts: ["api.risk.com", "rpc.edge.local"],
      requestCount: 2
    }
  );

  assert.equal(result.reasonCode, "ACTION_MISMATCH");
});
