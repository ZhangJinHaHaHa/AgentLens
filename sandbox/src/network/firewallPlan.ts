/**
 * 防火墙规划器把 manifest 的域名/RPC 声明解析为确定性 IPv4 目的地址，并生成容器 OUTPUT 链的默认拒绝命令序列；不执行 iptables 或验证实际规则。
 * manifest 与 DNS 结果均是不可信边界，调用方提供 resolver 以明确解析时点；DNS server 仅获准 53/udp,tcp，私网拒绝规则排在一般允许目标之前。
 * 输出是供受控容器 shell 执行的命令，不是可任意拼接的用户脚本；主机名应先解析成 IP，URL 语法错误或解析失败必须中止规划而非扩大出口。
 * 去重与排序保证相同输入得到稳定计划，便于验证和审计；DNS 绑定是一次性快照，地址漂移需要重新规划，模块本身不维护并发或动态刷新状态。
 */
import { isIP } from "node:net";

import { buildEgressPolicy } from "./egressPolicy";
import type { SandboxManifest } from "../types/manifest";

export interface FirewallPlan {
  commands: string[];
}

export type HostResolver = (host: string) => Promise<string[]>;
export interface ResolveFirewallPlanOptions {
  resolveHost: HostResolver;
  dnsServers?: string[];
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function extractAllowedHostsFromRpcEndpoints(endpoints: string[]): string[] {
  return endpoints.map((endpoint) => new URL(endpoint).hostname);
}

function buildFirewallPlanFromDestinations(
  allowedDestinations: string[],
  deniedCidrs: string[],
  dnsServers: string[] = []
): FirewallPlan {
  return {
    commands: [
      "iptables -F OUTPUT",
      "iptables -P OUTPUT DROP",
      "iptables -A OUTPUT -o lo -j ACCEPT",
      "iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
      ...[...dnsServers].sort().flatMap((server) => [
        `iptables -A OUTPUT -p udp -d ${server} --dport 53 -j ACCEPT`,
        `iptables -A OUTPUT -p tcp -d ${server} --dport 53 -j ACCEPT`
      ]),
      ...[...deniedCidrs].sort().map((cidr) => `iptables -A OUTPUT -d ${cidr} -j DROP`),
      ...[...allowedDestinations].sort().map((host) => `iptables -A OUTPUT -d ${host} -j ACCEPT`)
    ]
  };
}

function getAllowedHosts(manifest: SandboxManifest): string[] {
  const policy = buildEgressPolicy(manifest);
  return unique([
    ...policy.allowedHosts,
    ...extractAllowedHostsFromRpcEndpoints(policy.allowedRpcEndpoints)
  ]);
}

export function buildFirewallPlan(manifest: SandboxManifest): FirewallPlan {
  const policy = buildEgressPolicy(manifest);
  return buildFirewallPlanFromDestinations(getAllowedHosts(manifest), policy.deniedCidrs);
}

export async function resolveFirewallPlan(
  manifest: SandboxManifest,
  options: ResolveFirewallPlanOptions
): Promise<FirewallPlan> {
  const policy = buildEgressPolicy(manifest);
  const resolvedDestinations = unique(
    (
      await Promise.all(
        getAllowedHosts(manifest).map(async (host) => {
          if (isIP(host)) {
            return [host];
          }

          return await options.resolveHost(host);
        })
      )
    ).flat()
  );

  return buildFirewallPlanFromDestinations(
    resolvedDestinations,
    policy.deniedCidrs,
    options.dnsServers ?? []
  );
}
