import test from "node:test";
import assert from "node:assert/strict";

import { getAuditRegistryInterface } from "../../src/listener/auditRegistryArtifact";
import { readAgentProfile } from "../../src/listener/readAgentProfile";

const contractInterface = getAuditRegistryInterface();

test("readAgentProfile calls eth_call with encoded getAgentProfile calldata and decodes totalBond and blacklisted", async () => {
  const responseData = contractInterface.encodeFunctionResult("getAgentProfile", [
    [
      "0x000000000000000000000000000000000000dEaD",
      "risk-agent",
      2,
      "1000000000000000000",
      true,
      1774536000,
      1774536086,
      7
    ]
  ]);
  const requests: Array<{ method: string; params: unknown[] }> = [];

  const profile = await readAgentProfile({
    rpcUrl: "https://rpc.edge.local",
    contractAddress: "0x1111111111111111111111111111111111111111",
    tokenId: 2n,
    fetchImpl: (async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string;
        params: unknown[];
      };
      requests.push(body);
      return {
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: responseData
        })
      } as Response;
    }) as typeof fetch
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.method, "eth_call");
  assert.deepEqual(requests[0]?.params, [
    {
      to: "0x1111111111111111111111111111111111111111",
      data: contractInterface.encodeFunctionData("getAgentProfile", [2n])
    },
    "latest"
  ]);
  assert.deepEqual(profile, {
    developer: "0x000000000000000000000000000000000000dEaD",
    agentName: "risk-agent",
    tokenId: 2n,
    totalBond: 1000000000000000000n,
    blacklisted: true,
    createdAt: 1774536000,
    lastAuditAt: 1774536086,
    auditCount: 7
  });
});
