import test from "node:test";
import assert from "node:assert/strict";

import {
  verifyFirewallRules,
  type CommandRunner
} from "../../src/network/firewallVerify";

test("verifyFirewallRules returns configured when all planned rules are present", async () => {
  const commandRunner: CommandRunner = async (command, args) => {
    assert.equal(command, "docker");
    assert.deepEqual(args, ["exec", "container-123", "iptables", "-S", "OUTPUT"]);

    return {
      stdout: `-P OUTPUT DROP
-A OUTPUT -o lo -j ACCEPT
-A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
-A OUTPUT -p udp -d 192.168.65.7 --dport 53 -j ACCEPT
-A OUTPUT -p tcp -d 192.168.65.7 --dport 53 -j ACCEPT
-A OUTPUT -d 10.0.0.0/8 -j DROP
-A OUTPUT -d 127.0.0.0/8 -j DROP
-A OUTPUT -d 169.254.0.0/16 -j DROP
-A OUTPUT -d 172.16.0.0/12 -j DROP
-A OUTPUT -d 192.168.0.0/16 -j DROP
-A OUTPUT -d 198.51.100.7 -j ACCEPT
-A OUTPUT -d 203.0.113.10 -j ACCEPT
`,
      stderr: "",
      exitCode: 0
    };
  };

  const result = await verifyFirewallRules(
    "container-123",
    {
      agent_name: "risk-agent",
      image: "registry.example.com/agents/risk-agent:1.0.0",
      allowed_hosts: ["api.risk.com"],
      allowed_rpc_endpoints: ["https://rpc.edge.local"]
    },
    {
      commandRunner,
      getDnsServers: async () => ["192.168.65.7"],
      resolveHost: async (host: string) => {
        if (host === "api.risk.com") {
          return ["203.0.113.10"];
        }

        if (host === "rpc.edge.local") {
          return ["198.51.100.7"];
        }

        throw new Error(`unexpected host: ${host}`);
      }
    }
  );

  assert.deepEqual(result, {
    configured: true,
    missingRules: []
  });
});

test("verifyFirewallRules tolerates iptables output normalization differences", async () => {
  const commandRunner: CommandRunner = async () => ({
    stdout: `-P OUTPUT DROP
-A OUTPUT -o lo -j ACCEPT
-A OUTPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
-A OUTPUT -d 192.168.65.7/32 -p udp -m udp --dport 53 -j ACCEPT
-A OUTPUT -d 192.168.65.7/32 -p tcp -m tcp --dport 53 -j ACCEPT
-A OUTPUT -d 10.0.0.0/8 -j DROP
-A OUTPUT -d 127.0.0.0/8 -j DROP
-A OUTPUT -d 169.254.0.0/16 -j DROP
-A OUTPUT -d 172.16.0.0/12 -j DROP
-A OUTPUT -d 192.168.0.0/16 -j DROP
-A OUTPUT -d 1.1.1.1/32 -j ACCEPT
`,
    stderr: "",
    exitCode: 0
  });

  const result = await verifyFirewallRules(
    "container-123",
    {
      agent_name: "local-test-agent",
      image: "agent-shenji/test-agent:local",
      allowed_hosts: ["1.1.1.1"],
      allowed_rpc_endpoints: ["http://1.1.1.1"]
    },
    { commandRunner, getDnsServers: async () => ["192.168.65.7"] }
  );

  assert.deepEqual(result, {
    configured: true,
    missingRules: []
  });
});

test("verifyFirewallRules returns missing rules when expected rules are absent", async () => {
  const commandRunner: CommandRunner = async () => ({
    stdout: `-P OUTPUT DROP
-A OUTPUT -o lo -j ACCEPT
`,
    stderr: "",
    exitCode: 0
  });

  const result = await verifyFirewallRules(
    "container-123",
    {
      agent_name: "risk-agent",
      image: "registry.example.com/agents/risk-agent:1.0.0",
      allowed_hosts: ["api.risk.com"],
      allowed_rpc_endpoints: ["https://rpc.edge.local"]
    },
    {
      commandRunner,
      getDnsServers: async () => ["192.168.65.7"],
      resolveHost: async (host: string) => {
        if (host === "api.risk.com") {
          return ["203.0.113.10"];
        }

        if (host === "rpc.edge.local") {
          return ["198.51.100.7"];
        }

        throw new Error(`unexpected host: ${host}`);
      }
    }
  );

  assert.equal(result.configured, false);
  assert.deepEqual(result.missingRules, [
    "-A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
    "-A OUTPUT -p udp -d 192.168.65.7 --dport 53 -j ACCEPT",
    "-A OUTPUT -p tcp -d 192.168.65.7 --dport 53 -j ACCEPT",
    "-A OUTPUT -d 10.0.0.0/8 -j DROP",
    "-A OUTPUT -d 127.0.0.0/8 -j DROP",
    "-A OUTPUT -d 169.254.0.0/16 -j DROP",
    "-A OUTPUT -d 172.16.0.0/12 -j DROP",
    "-A OUTPUT -d 192.168.0.0/16 -j DROP",
    "-A OUTPUT -d 198.51.100.7 -j ACCEPT",
    "-A OUTPUT -d 203.0.113.10 -j ACCEPT"
  ]);
});
