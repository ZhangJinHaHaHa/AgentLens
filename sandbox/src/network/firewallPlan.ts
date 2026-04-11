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
