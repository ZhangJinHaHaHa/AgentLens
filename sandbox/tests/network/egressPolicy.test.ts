import test from "node:test";
import assert from "node:assert/strict";

import { buildEgressPolicy } from "../../src/network/egressPolicy";

test("buildEgressPolicy normalizes hosts and rpc endpoints into a deduplicated policy", () => {
  const policy = buildEgressPolicy({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com", "rpc.edge.local"],
    allowed_rpc_endpoints: ["https://rpc.edge.local", "https://rpc.edge.local"]
  });

  assert.deepEqual(policy, {
    allowedHosts: ["api.risk.com", "rpc.edge.local"],
    allowedRpcEndpoints: ["https://rpc.edge.local"],
    deniedCidrs: ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16"]
  });
});
