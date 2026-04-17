import test from "node:test";
import assert from "node:assert/strict";

import { writeAuditResult } from "../../src/listener/writeAuditResult";
import type { WriteAuditResultDependencies } from "../../src/listener/writeAuditResult";
import type { ProcessedAuditRequested } from "../../src/listener/types";

type SubmitContractCallRequest = Parameters<WriteAuditResultDependencies["submitContractCall"]>[0];

function buildProcessed(
  overrides: Partial<ProcessedAuditRequested["writeback"]> = {}
): ProcessedAuditRequested {
  const baseWriteback: ProcessedAuditRequested["writeback"] = {
    tokenId: 1n,
    auditScore: 100,
    memoryPeakMb: 256,
    cpuAvgMilli: 120,
    requestIpCount: 1,
    status: "Passed",
    manifestHash: "a".repeat(64),
    reportHash: "b".repeat(64),
    evidenceRoot: "e".repeat(64),
    attestationHash: "0".repeat(64),
    evidenceCID: "",
    reportCID: "",
    manifestUrl: "https://example.com/manifest.json"
  };
  return {
    reportPersistence: {
      reportFileName: "persisted-report.json",
      reportFilePath: "/tmp/reports/persisted-report.json"
    },
    writeback: {
      ...baseWriteback,
      ...overrides
    }
  } as ProcessedAuditRequested;
}

test("writeAuditResult maps ProcessedAuditRequested into recordAuditResult call arguments", async () => {
  const captured: unknown[] = [];
  const submitResult = { transactionHash: "0xabc", blockNumber: 123 };

  const result = await writeAuditResult(buildProcessed({ status: "Passed" }), {
    submitContractCall: async (request: SubmitContractCallRequest) => {
      captured.push(request);
      return submitResult;
    }
  });

  assert.deepEqual(result, submitResult);
  assert.deepEqual(captured, [
    {
      method: "recordAuditResult",
      args: {
        tokenId: 1n,
        auditScore: 100,
        memoryPeakMb: 256,
        cpuAvgMilli: 120,
        requestIpCount: 1,
        status: 1,
        manifestHash: "0x" + "a".repeat(64),
        reportHash: "0x" + "b".repeat(64),
        evidenceRoot: "0x" + "e".repeat(64),
        attestationHash: "0x" + "0".repeat(64),
        evidenceCID: "",
        reportCID: "",
        manifestUrl: "https://example.com/manifest.json"
      }
    }
  ]);
});

test("writeAuditResult maps Failed status to enum 2 and preserves already-prefixed hashes", async () => {
  const captured: unknown[] = [];

  await writeAuditResult(
    buildProcessed({
      tokenId: 9n,
      auditScore: 0,
      memoryPeakMb: 0,
      cpuAvgMilli: 0,
      requestIpCount: 0,
      status: "Failed",
      manifestHash: "0x" + "c".repeat(64),
      reportHash: "0x" + "d".repeat(64),
      evidenceRoot: "0x" + "e".repeat(64),
      attestationHash: "0x" + "f".repeat(64),
      evidenceCID: "bafy-evidence",
      reportCID: "bafybeigdyrzt",
      manifestUrl: "ipfs://manifest-cid"
    }),
    {
      submitContractCall: async (request: SubmitContractCallRequest) => {
        captured.push(request);
        return { transactionHash: "0xdef", blockNumber: 222 };
      }
    }
  );

  assert.deepEqual(captured, [
    {
      method: "recordAuditResult",
      args: {
        tokenId: 9n,
        auditScore: 0,
        memoryPeakMb: 0,
        cpuAvgMilli: 0,
        requestIpCount: 0,
        status: 2,
        manifestHash: "0x" + "c".repeat(64),
        reportHash: "0x" + "d".repeat(64),
        evidenceRoot: "0x" + "e".repeat(64),
        attestationHash: "0x" + "f".repeat(64),
        evidenceCID: "bafy-evidence",
        reportCID: "bafybeigdyrzt",
        manifestUrl: "ipfs://manifest-cid"
      }
    }
  ]);
});

test("writeAuditResult routes to recordAuditResultV2 when dimensionalScores are present", async () => {
  const captured: unknown[] = [];

  const processed = buildProcessed({
    attestationHash: "0x" + "f".repeat(64),
    dimensionalScores: {
      security: 8500,
      taskExecution: 7200,
      cognitive: 6100,
      environment: 9000,
      engineering: 7800,
      compliance: 9500
    }
  });

  await writeAuditResult(processed, {
    submitContractCall: async (request: SubmitContractCallRequest) => {
      captured.push(request);
      return { transactionHash: "0xdef", blockNumber: 333 };
    }
  });

  assert.equal(captured.length, 1);
  const recorded = captured[0] as { method: string; args: Record<string, unknown> };
  assert.equal(recorded.method, "recordAuditResultV2");
  assert.deepEqual(recorded.args, {
    tokenId: 1n,
    auditScore: 100,
    memoryPeakMb: 256,
    cpuAvgMilli: 120,
    requestIpCount: 1,
    status: 1,
    manifestHash: "0x" + "a".repeat(64),
    reportHash: "0x" + "b".repeat(64),
    evidenceRoot: "0x" + "e".repeat(64),
    attestationHash: "0x" + "f".repeat(64),
    evidenceCID: "",
    reportCID: "",
    manifestUrl: "https://example.com/manifest.json",
    dimensionalScores: {
      security: 8500,
      taskExecution: 7200,
      cognitive: 6100,
      environment: 9000,
      engineering: 7800,
      compliance: 9500
    }
  });
});

test("writeAuditResult leaves calldata unchanged when ProcessedAuditRequested includes reportPersistence", async () => {
  const processed = buildProcessed();
  processed.reportPersistence = {
    reportFileName: "local-report.json",
    reportFilePath: "/tmp/.runtime/reports/local-report.json"
  };

  const captured: unknown[] = [];
  await writeAuditResult(processed, {
    submitContractCall: async (request: SubmitContractCallRequest) => {
      captured.push(request);
      return { transactionHash: "0xabc", blockNumber: 123 };
    }
  });

  assert.deepEqual(captured, [
    {
      method: "recordAuditResult",
      args: {
        tokenId: 1n,
        auditScore: 100,
        memoryPeakMb: 256,
        cpuAvgMilli: 120,
        requestIpCount: 1,
        status: 1,
        manifestHash: "0x" + "a".repeat(64),
        reportHash: "0x" + "b".repeat(64),
        evidenceRoot: "0x" + "e".repeat(64),
        attestationHash: "0x" + "0".repeat(64),
        evidenceCID: "",
        reportCID: "",
        manifestUrl: "https://example.com/manifest.json"
      }
    }
  ]);

  const args = (captured[0] as { args: Record<string, unknown> }).args;
  assert.equal("reportPersistence" in args, false);
  assert.equal("reportFilePath" in args, false);
});
