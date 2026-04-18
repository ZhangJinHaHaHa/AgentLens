import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNetworkActivitySummary,
  type NetworkActivitySummary
} from "../../src/monitor/networkActivitySummary";
import type {
  EnhancedNetworkEvent,
  EnhancedNetworkSnapshot
} from "../../src/monitor/enhancedNetworkMonitor";
import type { SandboxManifest } from "../../src/types/manifest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeManifest(overrides: Partial<SandboxManifest> = {}): SandboxManifest {
  return {
    agent_name: "test-agent",
    image: "registry.example.com/test-agent:1.0.0",
    allowed_hosts: [],
    allowed_rpc_endpoints: [],
    ...overrides
  };
}

function makeEvent(overrides: Partial<EnhancedNetworkEvent> = {}): EnhancedNetworkEvent {
  return {
    timestamp: "2026-04-11T10:00:00.000Z",
    protocol: "tcp",
    srcAddr: "172.17.0.2",
    srcPort: 45678,
    dstAddr: "93.184.216.34",
    dstPort: 443,
    state: "ESTABLISHED",
    ...overrides
  };
}

function makeSnapshot(
  events: EnhancedNetworkEvent[],
  source: EnhancedNetworkSnapshot["source"] = "conntrack"
): EnhancedNetworkSnapshot {
  return { source, events };
}

// ---------------------------------------------------------------------------
// Basic summary metrics
// ---------------------------------------------------------------------------

test("buildNetworkActivitySummary returns zero counters for empty events", () => {
  const summary = buildNetworkActivitySummary(
    makeSnapshot([]),
    makeManifest()
  );

  assert.equal(summary.totalConnections, 0);
  assert.equal(summary.uniqueDestinations, 0);
  assert.equal(summary.uniquePorts, 0);
  assert.deepEqual(summary.protocols, { tcp: 0, udp: 0 });
  assert.equal(summary.totalBytesSent, 0);
  assert.equal(summary.totalBytesReceived, 0);
  assert.deepEqual(summary.connections, []);
  assert.deepEqual(summary.undeclaredDestinations, []);
});

test("buildNetworkActivitySummary counts total connections", () => {
  const events = [
    makeEvent({ dstAddr: "1.1.1.1", dstPort: 80 }),
    makeEvent({ dstAddr: "1.1.1.1", dstPort: 443 }),
    makeEvent({ dstAddr: "8.8.8.8", dstPort: 53, protocol: "udp" })
  ];

  const summary = buildNetworkActivitySummary(
    makeSnapshot(events),
    makeManifest({ allowed_hosts: ["1.1.1.1", "8.8.8.8"] })
  );

  assert.equal(summary.totalConnections, 3);
});

test("buildNetworkActivitySummary counts unique destination IPs", () => {
  const events = [
    makeEvent({ dstAddr: "1.1.1.1" }),
    makeEvent({ dstAddr: "1.1.1.1" }),
    makeEvent({ dstAddr: "8.8.8.8" })
  ];

  const summary = buildNetworkActivitySummary(
    makeSnapshot(events),
    makeManifest({ allowed_hosts: ["1.1.1.1", "8.8.8.8"] })
  );

  assert.equal(summary.uniqueDestinations, 2);
});

test("buildNetworkActivitySummary counts unique destination IP:port pairs", () => {
  const events = [
    makeEvent({ dstAddr: "1.1.1.1", dstPort: 80 }),
    makeEvent({ dstAddr: "1.1.1.1", dstPort: 443 }),
    makeEvent({ dstAddr: "1.1.1.1", dstPort: 443 }),
    makeEvent({ dstAddr: "8.8.8.8", dstPort: 53 })
  ];

  const summary = buildNetworkActivitySummary(
    makeSnapshot(events),
    makeManifest({ allowed_hosts: ["1.1.1.1", "8.8.8.8"] })
  );

  // 1.1.1.1:80, 1.1.1.1:443, 8.8.8.8:53
  assert.equal(summary.uniquePorts, 3);
});

// ---------------------------------------------------------------------------
// Protocol counting
// ---------------------------------------------------------------------------

test("buildNetworkActivitySummary counts protocols correctly", () => {
  const events = [
    makeEvent({ protocol: "tcp" }),
    makeEvent({ protocol: "tcp" }),
    makeEvent({ protocol: "udp", dstAddr: "8.8.8.8", dstPort: 53 })
  ];

  const summary = buildNetworkActivitySummary(
    makeSnapshot(events),
    makeManifest({ allowed_hosts: ["93.184.216.34", "8.8.8.8"] })
  );

  assert.deepEqual(summary.protocols, { tcp: 2, udp: 1 });
});

// ---------------------------------------------------------------------------
// Bytes accumulation
// ---------------------------------------------------------------------------

test("buildNetworkActivitySummary sums bytes sent and received", () => {
  const events = [
    makeEvent({ bytesOriginal: 100, bytesReply: 200 }),
    makeEvent({ bytesOriginal: 300, bytesReply: 400 }),
    makeEvent({ dstAddr: "8.8.8.8", bytesOriginal: 50 })
  ];

  const summary = buildNetworkActivitySummary(
    makeSnapshot(events),
    makeManifest({ allowed_hosts: ["93.184.216.34", "8.8.8.8"] })
  );

  assert.equal(summary.totalBytesSent, 450);
  assert.equal(summary.totalBytesReceived, 600);
});

test("buildNetworkActivitySummary handles events without bytes counters", () => {
  const events = [
    makeEvent({}),  // no bytesOriginal or bytesReply
    makeEvent({ bytesOriginal: 100 })
  ];

  const summary = buildNetworkActivitySummary(
    makeSnapshot(events),
    makeManifest({ allowed_hosts: ["93.184.216.34"] })
  );

  assert.equal(summary.totalBytesSent, 100);
  assert.equal(summary.totalBytesReceived, 0);
});

// ---------------------------------------------------------------------------
// Undeclared destination detection
// ---------------------------------------------------------------------------

test("buildNetworkActivitySummary detects undeclared destinations", () => {
  const events = [
    makeEvent({ dstAddr: "93.184.216.34" }),
    makeEvent({ dstAddr: "198.51.100.7" }),
    makeEvent({ dstAddr: "10.0.0.1" })
  ];

  const manifest = makeManifest({
    allowed_hosts: ["93.184.216.34"]
  });

  const summary = buildNetworkActivitySummary(
    makeSnapshot(events),
    manifest
  );

  assert.deepEqual(summary.undeclaredDestinations, ["10.0.0.1", "198.51.100.7"]);
});

test("buildNetworkActivitySummary treats RPC endpoint hostnames as allowed", () => {
  const events = [
    makeEvent({ dstAddr: "rpc.edge.local" })
  ];

  const manifest = makeManifest({
    allowed_hosts: [],
    allowed_rpc_endpoints: ["https://rpc.edge.local:8545"]
  });

  const summary = buildNetworkActivitySummary(
    makeSnapshot(events),
    manifest
  );

  assert.deepEqual(summary.undeclaredDestinations, []);
});

test("buildNetworkActivitySummary returns empty undeclared list when all destinations are allowed", () => {
  const events = [
    makeEvent({ dstAddr: "1.1.1.1" }),
    makeEvent({ dstAddr: "8.8.8.8" })
  ];

  const manifest = makeManifest({
    allowed_hosts: ["1.1.1.1", "8.8.8.8"]
  });

  const summary = buildNetworkActivitySummary(
    makeSnapshot(events),
    manifest
  );

  assert.deepEqual(summary.undeclaredDestinations, []);
});

test("buildNetworkActivitySummary deduplicates undeclared destinations", () => {
  const events = [
    makeEvent({ dstAddr: "198.51.100.7" }),
    makeEvent({ dstAddr: "198.51.100.7" }),
    makeEvent({ dstAddr: "198.51.100.7" })
  ];

  const summary = buildNetworkActivitySummary(
    makeSnapshot(events),
    makeManifest()
  );

  assert.deepEqual(summary.undeclaredDestinations, ["198.51.100.7"]);
});

// ---------------------------------------------------------------------------
// Connection list
// ---------------------------------------------------------------------------

test("buildNetworkActivitySummary includes all events in connections list", () => {
  const events = [
    makeEvent({ dstAddr: "1.1.1.1", dstPort: 80 }),
    makeEvent({ dstAddr: "8.8.8.8", dstPort: 53, protocol: "udp" })
  ];

  const summary = buildNetworkActivitySummary(
    makeSnapshot(events),
    makeManifest({ allowed_hosts: ["1.1.1.1", "8.8.8.8"] })
  );

  assert.equal(summary.connections.length, 2);
  assert.equal(summary.connections[0].dstAddr, "1.1.1.1");
  assert.equal(summary.connections[1].dstAddr, "8.8.8.8");
});

test("buildNetworkActivitySummary does not mutate the original events array", () => {
  const events = [makeEvent({ dstAddr: "1.1.1.1" })];
  const snapshot = makeSnapshot(events);

  const summary = buildNetworkActivitySummary(snapshot, makeManifest({ allowed_hosts: ["1.1.1.1"] }));

  // The returned connections should be a copy
  assert.notEqual(summary.connections, snapshot.events);
  assert.deepEqual(summary.connections, snapshot.events);
});

// ---------------------------------------------------------------------------
// Edge case: malformed RPC endpoint URL
// ---------------------------------------------------------------------------

test("buildNetworkActivitySummary ignores malformed RPC endpoint URLs gracefully", () => {
  const events = [
    makeEvent({ dstAddr: "1.1.1.1" })
  ];

  const manifest = makeManifest({
    allowed_hosts: ["1.1.1.1"],
    allowed_rpc_endpoints: ["not-a-valid-url"]
  });

  // Should not throw
  const summary = buildNetworkActivitySummary(
    makeSnapshot(events),
    manifest
  );

  assert.equal(summary.totalConnections, 1);
  assert.deepEqual(summary.undeclaredDestinations, []);
});
