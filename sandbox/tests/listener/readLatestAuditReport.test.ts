import test from "node:test";
import assert from "node:assert/strict";

import { getAuditRegistryInterface } from "../../src/listener/auditRegistryArtifact";
import { readLatestAuditReport } from "../../src/listener/readLatestAuditReport";

const contractInterface = getAuditRegistryInterface();

test("readLatestAuditReport calls eth_call with encoded getLatestAuditReport calldata and decodes the tuple", async () => {
  const responseData = contractInterface.encodeFunctionResult("getLatestAuditReport", [
    [
      1,
      1774536086,
      100,
      256,
      120,
      1,
      1,
      `0x${"a".repeat(64)}`,
      `0x${"b".repeat(64)}`,
      `0x${"0".repeat(64)}`,
      `0x${"0".repeat(64)}`,
      "",
      "",
      "/tmp/manifest.json",
      false,
      false
    ]
  ]);
  const requests: Array<{ method: string; params: unknown[] }> = [];

  const latest = await readLatestAuditReport({
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
      data: contractInterface.encodeFunctionData("getLatestAuditReport", [2n])
    },
    "latest"
  ]);
  assert.deepEqual(latest, {
    auditId: 1,
    timestamp: 1774536086,
    auditScore: 100,
    memoryPeakMb: 256,
    cpuAvgMilli: 120,
    requestIpCount: 1,
    status: 1,
    manifestHash: `0x${"a".repeat(64)}`,
    reportHash: `0x${"b".repeat(64)}`,
    evidenceRoot: `0x${"0".repeat(64)}`,
    attestationHash: `0x${"0".repeat(64)}`,
    reportCID: "",
    manifestUrl: "/tmp/manifest.json",
    appealRequested: false,
    appealApproved: false
  });
});
