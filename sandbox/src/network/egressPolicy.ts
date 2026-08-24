/**
 * 出口策略领域层从 manifest 构造允许主机/RPC 与固定私网拒绝段，并对观测流量及自报 actions 给出原因码；不解析 DNS、不下发防火墙，也不发起网络请求。
 * manifest、action 与活动记录均是不可信审计输入，输出是确定性策略或单个失败原因；URL 解析失败应暴露配置错误而非静默放宽允许集合。
 * 私网检测和主机比对是明确的 IPv4/精确字符串规则，真正强制由 firewallPlan/dockerRunner 完成；策略评估结果不能替代宿主级隔离证明。
 * 纯函数无共享状态并可并发使用；拒绝 CIDR 集、去重排序、失败优先级和 ACTION_MISMATCH 语义属于审计报告的兼容不变量。
 */
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
