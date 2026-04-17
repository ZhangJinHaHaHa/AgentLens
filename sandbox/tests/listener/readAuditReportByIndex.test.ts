import test from "node:test";
import assert from "node:assert/strict";

import { getAuditRegistryInterface } from "../../src/listener/auditRegistryArtifact";
import { readAuditReportByIndex } from "../../src/listener/readAuditReportByIndex";

const contractInterface = getAuditRegistryInterface();

test("readAuditReportByIndex calls eth_call with encoded calldata and decodes the requested audit record", async () => {
  const responseData = contractInterface.encodeFunctionResult("getAuditReportByIndex", [
    [
      3,
      1774536086,
      0,
      256,
      120,
      1,
      3,
      `0x${"a".repeat(64)}`,
      `0x${"b".repeat(64)}`,
      `0x${"0".repeat(64)}`,
      `0x${"0".repeat(64)}`,
      "",
      "bafybeigdyrzt",
      "https://example.com/manifest.json",
      false,
      false
    ]
  ]);
  const requests: Array<{ method: string; params: unknown[] }> = [];

  const record = await readAuditReportByIndex({
    rpcUrl: "https://rpc.edge.local",
    contractAddress: "0x1111111111111111111111111111111111111111",
    tokenId: 2n,
    index: 2,
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
      data: contractInterface.encodeFunctionData("getAuditReportByIndex", [2n, 2])
    },
    "latest"
  ]);
  assert.deepEqual(record, {
    auditId: 3,
    timestamp: 1774536086,
    auditScore: 0,
    memoryPeakMb: 256,
    cpuAvgMilli: 120,
    requestIpCount: 1,
    status: 3,
    manifestHash: `0x${"a".repeat(64)}`,
    reportHash: `0x${"b".repeat(64)}`,
    evidenceRoot: `0x${"0".repeat(64)}`,
    attestationHash: `0x${"0".repeat(64)}`,
    reportCID: "bafybeigdyrzt",
    manifestUrl: "https://example.com/manifest.json",
    appealRequested: false,
    appealApproved: false
  });
});
