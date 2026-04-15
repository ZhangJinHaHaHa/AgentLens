import test from "node:test";
import assert from "node:assert/strict";

import { buildFirewallPlan, resolveFirewallPlan } from "../../src/network/firewallPlan";

test("buildFirewallPlan returns default deny rules plus manifest allow rules", () => {
  const plan = buildFirewallPlan({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  assert.deepEqual(plan.commands, [
    "iptables -F OUTPUT",
    "iptables -P OUTPUT DROP",
    "iptables -A OUTPUT -o lo -j ACCEPT",
    "iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
    "iptables -A OUTPUT -d 10.0.0.0/8 -j DROP",
    "iptables -A OUTPUT -d 127.0.0.0/8 -j DROP",
    "iptables -A OUTPUT -d 169.254.0.0/16 -j DROP",
    "iptables -A OUTPUT -d 172.16.0.0/12 -j DROP",
    "iptables -A OUTPUT -d 192.168.0.0/16 -j DROP",
    "iptables -A OUTPUT -d api.risk.com -j ACCEPT",
    "iptables -A OUTPUT -d rpc.edge.local -j ACCEPT"
  ]);
});

test("resolveFirewallPlan expands hostnames into deduplicated IPv4 allow rules", async () => {
  const plan = await resolveFirewallPlan(
    {
      agent_name: "risk-agent",
      image: "registry.example.com/agents/risk-agent:1.0.0",
      allowed_hosts: ["api.risk.com"],
      allowed_rpc_endpoints: ["https://rpc.edge.local"]
    },
    {
      resolveHost: async (host: string) => {
        if (host === "api.risk.com") {
          return ["203.0.113.10", "203.0.113.10"];
        }

        if (host === "rpc.edge.local") {
          return ["198.51.100.7"];
        }

        throw new Error(`unexpected host: ${host}`);
      },
      dnsServers: ["192.168.65.7"]
    }
  );

  assert.deepEqual(plan.commands, [
    "iptables -F OUTPUT",
    "iptables -P OUTPUT DROP",
    "iptables -A OUTPUT -o lo -j ACCEPT",
    "iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
    "iptables -A OUTPUT -p udp -d 192.168.65.7 --dport 53 -j ACCEPT",
    "iptables -A OUTPUT -p tcp -d 192.168.65.7 --dport 53 -j ACCEPT",
    "iptables -A OUTPUT -d 10.0.0.0/8 -j DROP",
    "iptables -A OUTPUT -d 127.0.0.0/8 -j DROP",
    "iptables -A OUTPUT -d 169.254.0.0/16 -j DROP",
    "iptables -A OUTPUT -d 172.16.0.0/12 -j DROP",
    "iptables -A OUTPUT -d 192.168.0.0/16 -j DROP",
    "iptables -A OUTPUT -d 198.51.100.7 -j ACCEPT",
    "iptables -A OUTPUT -d 203.0.113.10 -j ACCEPT"
  ]);
});
