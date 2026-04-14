import test from "node:test";
import assert from "node:assert/strict";

import { getCdkV2Interface } from "../../src/cdk/chain/cdkArtifact";
import {
  readAgentProfile,
  readLatestAuditReport,
  readServiceFee,
  readMinimumBond
} from "../../src/cdk/chain/cdkRegistryReader";

const iface = getCdkV2Interface();

function makeFetchMock(responseData: string): typeof fetch {
  return (async () => ({
    ok: true,
    json: async () => ({ jsonrpc: "2.0", id: 1, result: responseData })
  })) as unknown as typeof fetch;
}

test("readAgentProfile decodes profile from V2 contract", async () => {
  const encoded = iface.encodeFunctionResult("getAgentProfile", [
    [
      "0x000000000000000000000000000000000000dEaD",
      "test-agent",
      5,
      "2000000000000000000",
      false,
      1700000000,
      1700001000,
      3
    ]
  ]);

  const profile = await readAgentProfile(
    {
      rpcUrl: "http://localhost:8545",
      contractAddress: "0x1111111111111111111111111111111111111111",
      fetchImpl: makeFetchMock(encoded)
    },
    5n
  );

  assert.equal(profile.agentName, "test-agent");
  assert.equal(profile.tokenId, 5n);
  assert.equal(profile.totalBond, 2000000000000000000n);
  assert.equal(profile.blacklisted, false);
  assert.equal(profile.auditCount, 3);
});

test("readLatestAuditReport decodes V2 report with dimensional scores", async () => {
  const encoded = iface.encodeFunctionResult("getLatestAuditReport", [
    [
      1,
      1700000000,
      85,
      256,
      120,
      3,
      1,
      "0x" + "ab".repeat(32),
      "0x" + "cd".repeat(32),
      "0x" + "ef".repeat(32),
      "0x" + "00".repeat(32),
      "",
      "QmTest",
      "https://example.com/manifest.json",
      false,
      false,
      [90, 80, 70, 85, 75, 95]
    ]
  ]);

  const report = await readLatestAuditReport(
    {
      rpcUrl: "http://localhost:8545",
      contractAddress: "0x1111111111111111111111111111111111111111",
      fetchImpl: makeFetchMock(encoded)
    },
    1n
  );

  assert.equal(report.auditId, 1);
  assert.equal(report.auditScore, 85);
  assert.equal(report.status, 1);
  assert.equal(report.reportCID, "QmTest");
  assert.equal(report.dimensionalScores.security, 90);
  assert.equal(report.dimensionalScores.taskExecution, 80);
  assert.equal(report.dimensionalScores.compliance, 95);
  assert.equal(report.evidenceRoot, "0x" + "ef".repeat(32));
  assert.equal(report.attestationHash, undefined);
});

test("readServiceFee decodes uint256", async () => {
  const encoded = iface.encodeFunctionResult("serviceFee", ["1000000000000000"]);

  const fee = await readServiceFee({
    rpcUrl: "http://localhost:8545",
    contractAddress: "0x1111111111111111111111111111111111111111",
    fetchImpl: makeFetchMock(encoded)
  });

  assert.equal(fee, 1000000000000000n);
});

test("readMinimumBond decodes uint256", async () => {
  const encoded = iface.encodeFunctionResult("minimumBond", ["5000000000000000000"]);

  const bond = await readMinimumBond({
    rpcUrl: "http://localhost:8545",
    contractAddress: "0x1111111111111111111111111111111111111111",
    fetchImpl: makeFetchMock(encoded)
  });

  assert.equal(bond, 5000000000000000000n);
});

test("readAgentProfile throws on JSON-RPC error", async () => {
  const fetchImpl = (async () => ({
    ok: true,
    json: async () => ({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32000, message: "execution reverted" }
    })
  })) as unknown as typeof fetch;

  await assert.rejects(
    () =>
      readAgentProfile(
        {
          rpcUrl: "http://localhost:8545",
          contractAddress: "0x1111111111111111111111111111111111111111",
          fetchImpl
        },
        999n
      ),
    { message: /execution reverted/ }
  );
});
