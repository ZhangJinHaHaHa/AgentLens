import type { AuditAction, SandboxManifest } from "../types/manifest";
import { reconcileAuditResponse } from "../audit/reconcileAuditResponse";

export interface EgressPolicy {
  allowedHosts: string[];
  allowedRpcEndpoints: string[];
  deniedCidrs: string[];
}

export interface NetworkActivity {
  requestedIps: string[];
  requestedHosts: string[];
  requestCount: number;
}

export interface NetworkPolicyEvaluation {
  reasonCode?: string;
}

const DENIED_CIDRS = [
  "127.0.0.0/8",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "169.254.0.0/16"
] as const;

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function extractAllowedHostsFromRpcEndpoints(endpoints: string[]): string[] {
  return endpoints.map((endpoint) => new URL(endpoint).hostname);
}

function isForbiddenIp(ip: string): boolean {
  if (ip.startsWith("127.")) {
    return true;
  }

  if (ip.startsWith("10.")) {
    return true;
  }

  if (ip.startsWith("192.168.")) {
    return true;
  }

  if (ip.startsWith("169.254.")) {
    return true;
  }

  const octets = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (octets.length === 4 && octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
    return true;
  }

  return false;
}

export function buildEgressPolicy(manifest: SandboxManifest): EgressPolicy {
  return {
    allowedHosts: unique(manifest.allowed_hosts),
    allowedRpcEndpoints: unique(manifest.allowed_rpc_endpoints),
    deniedCidrs: [...DENIED_CIDRS]
  };
}

export function evaluateNetworkActivity(
  activity: NetworkActivity,
  policy: EgressPolicy
): NetworkPolicyEvaluation {
  if (activity.requestedIps.some(isForbiddenIp)) {
    return { reasonCode: "FORBIDDEN_IP_ACCESS" };
  }

  const allowedHosts = new Set([
    ...policy.allowedHosts,
    ...extractAllowedHostsFromRpcEndpoints(policy.allowedRpcEndpoints)
  ]);

  if (activity.requestedHosts.some((host) => !allowedHosts.has(host))) {
    return { reasonCode: "UNDECLARED_EGRESS" };
  }

  return {};
}

export function evaluateActionConsistency(
  actions: AuditAction[],
  activity: NetworkActivity
): NetworkPolicyEvaluation {
  const { undeclaredObservedHosts } = reconcileAuditResponse(actions, activity);
  return undeclaredObservedHosts.length > 0 ? { reasonCode: "ACTION_MISMATCH" } : {};
}
