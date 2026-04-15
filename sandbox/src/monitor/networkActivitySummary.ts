import type { SandboxManifest } from "../types/manifest";
import type { EnhancedNetworkEvent, EnhancedNetworkSnapshot } from "./enhancedNetworkMonitor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NetworkActivitySummary {
  totalConnections: number;
  uniqueDestinations: number;
  uniquePorts: number;
  protocols: { tcp: number; udp: number };
  totalBytesSent: number;
  totalBytesReceived: number;
  connections: EnhancedNetworkEvent[];
  undeclaredDestinations: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractAllowedHosts(manifest: SandboxManifest): ReadonlySet<string> {
  const hosts = new Set<string>(manifest.allowed_hosts);

  for (const endpoint of manifest.allowed_rpc_endpoints) {
    try {
      hosts.add(new URL(endpoint).hostname);
    } catch {
      // skip malformed URLs
    }
  }

  return hosts;
}

function uniqueDestinationIps(events: readonly EnhancedNetworkEvent[]): ReadonlySet<string> {
  const ips = new Set<string>();

  for (const event of events) {
    ips.add(event.dstAddr);
  }

  return ips;
}

function uniqueDestinationPorts(events: readonly EnhancedNetworkEvent[]): ReadonlySet<string> {
  const keys = new Set<string>();

  for (const event of events) {
    keys.add(`${event.dstAddr}:${event.dstPort}`);
  }

  return keys;
}

function countByProtocol(events: readonly EnhancedNetworkEvent[]): { tcp: number; udp: number } {
  let tcp = 0;
  let udp = 0;

  for (const event of events) {
    if (event.protocol === "tcp") {
      tcp += 1;
    } else {
      udp += 1;
    }
  }

  return { tcp, udp };
}

function sumBytes(
  events: readonly EnhancedNetworkEvent[],
  field: "bytesOriginal" | "bytesReply"
): number {
  let total = 0;

  for (const event of events) {
    const value = event[field];

    if (value !== undefined) {
      total += value;
    }
  }

  return total;
}

/**
 * Detect destination IPs that are NOT covered by the manifest's allowed hosts
 * or RPC endpoint hostnames.
 *
 * Because the manifest declares hostnames but connections only carry IPs, a
 * strict comparison is not always possible without DNS resolution. Here we
 * compare the destination IP against the allowed hosts set. If the IP itself
 * does not appear as an allowed host entry it is considered undeclared.
 *
 * Callers performing real audits should resolve allowed hosts to IPs beforehand
 * and pass a manifest with those IPs added to `allowed_hosts`.
 */
function findUndeclaredDestinations(
  events: readonly EnhancedNetworkEvent[],
  allowedHosts: ReadonlySet<string>
): string[] {
  const undeclared = new Set<string>();

  for (const event of events) {
    if (!allowedHosts.has(event.dstAddr)) {
      undeclared.add(event.dstAddr);
    }
  }

  return [...undeclared].sort();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildNetworkActivitySummary(
  snapshot: EnhancedNetworkSnapshot,
  manifest: SandboxManifest
): NetworkActivitySummary {
  const events = snapshot.events;
  const allowedHosts = extractAllowedHosts(manifest);

  return {
    totalConnections: events.length,
    uniqueDestinations: uniqueDestinationIps(events).size,
    uniquePorts: uniqueDestinationPorts(events).size,
    protocols: countByProtocol(events),
    totalBytesSent: sumBytes(events, "bytesOriginal"),
    totalBytesReceived: sumBytes(events, "bytesReply"),
    connections: [...events],
    undeclaredDestinations: findUndeclaredDestinations(events, allowedHosts)
  };
}
