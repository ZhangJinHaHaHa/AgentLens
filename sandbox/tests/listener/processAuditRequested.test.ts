import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { processAuditRequested } from "../../src/listener/processAuditRequested";
import { isRetryableAuditExecutionFailure } from "../../src/listener/retryAuditExecutionQueue";
import type { AuditRequestedEvent } from "../../src/listener/types";
import type { AuditSolveRequest, LocalAuditResult, SandboxManifest } from "../../src/types/manifest";
import type { PersistAuditReportOptions, PersistedAuditReportArtifact } from "../../src/report/persistAuditReport";
import type { StorePersistedAuditReportOptions } from "../../src/report/storePersistedAuditReport";
import type { PersistedAuditEvidenceArtifact } from "../../src/evidence/persistAuditEvidence";
import type { PersistedAuditAttestationArtifact } from "../../src/attestation/persistAuditAttestation";

function buildEvent(overrides: Partial<AuditRequestedEvent> = {}): AuditRequestedEvent {
  return {
    eventKey: "0xabc:0",
    tokenId: 1n,
    developer: "0x000000000000000000000000000000000000dEaD",
    agentName: "risk-agent",
    manifestUrl: "https://example.com/manifest.json",
    blockNumber: 123,
    transactionHash: "0xabc",
    ...overrides
  };
}

function buildCompletedResult(overrides: Partial<LocalAuditResult> = {}): LocalAuditResult {
  return {
    agentName: "risk-agent",
    manifestHash: "a".repeat(64),
    healthcheckPassed: true,
    answer: "safe result",
    actions: [{ type: "web_request", url: "https://api.risk.com/v1/alert" }],
    decisionType: "undetermined",
    cpuAvgMilli: 120,
    memoryPeakMb: 256,
    requestedIps: ["203.0.113.10"],
    requestedHosts: ["api.risk.com"],
    requestCount: 1,
    status: "completed",
    startedAt: "2026-03-23T10:00:00.000Z",
    finishedAt: "2026-03-23T10:00:05.000Z",
    ...overrides
  };
}

function buildPersistedReport(
  overrides: Partial<PersistedAuditReportArtifact> = {}
): PersistedAuditReportArtifact {
  const defaultName = overrides.reportFileName ?? "persisted-report.json";

  return {
    reportFileName: defaultName,
    reportFilePath: overrides.reportFilePath ?? path.join("/tmp/reports", defaultName),
    ...overrides
  };
}

function buildPersistedEvidence(
  overrides: Partial<PersistedAuditEvidenceArtifact> = {}
): PersistedAuditEvidenceArtifact {
  const defaultName = overrides.evidenceFileName ?? "persisted-evidence.json";

  return {
    evidenceFileName: defaultName,
    evidenceFilePath: overrides.evidenceFilePath ?? path.join("/tmp/evidence", defaultName),
    evidenceRoot: overrides.evidenceRoot ?? "e".repeat(64),
    ...overrides
  };
}

function buildPersistedAttestation(
  overrides: Partial<PersistedAuditAttestationArtifact> = {}
): PersistedAuditAttestationArtifact {
  const defaultName = overrides.attestationFileName ?? "persisted-attestation.json";

  return {
    attestationFileName: defaultName,
    attestationFilePath: overrides.attestationFilePath ?? path.join("/tmp/attestations", defaultName),
    attestationHash: overrides.attestationHash ?? "f".repeat(64),
    ...overrides
  };
}

test("processAuditRequested validates the manifest name, runs the sandbox audit, and returns a writeback summary", async () => {
  const calls: string[] = [];
  const request: AuditSolveRequest = {
    task_id: "task-123",
    question: "question",
    context: { history: [] },
    constraints: { response_format: "json" }
  };

  const processed = await processAuditRequested(buildEvent(), {
    loadManifestSource: async () => {
      calls.push("load");
      return {
        manifest: {
          agent_name: "risk-agent",
          image: "agent-shenji/test-agent:local",
          allowed_hosts: ["api.risk.com"],
          allowed_rpc_endpoints: ["https://rpc.edge.local"]
        } satisfies SandboxManifest,
        manifestHash: "b".repeat(64),
        sourceContents: "{}"
      };
    },
    persistAuditReport: async (options: PersistAuditReportOptions) => {
      calls.push(`persist:${options.event.eventKey}`);
      return buildPersistedReport({
        reportFileName: `${options.event.tokenId.toString()}.json`
      });
    },
    persistAuditEvidence: async (options) => {
      calls.push(`evidence:${options.eventKey}`);
      assert.equal(options.chain.events.length > 0, true);
      return buildPersistedEvidence({
        evidenceFileName: `${options.tokenId.toString()}.evidence.json`
      });
    },
    buildAuditRequest: (event, _manifest) => {
      calls.push(`request:${event.eventKey}`);
      return request;
    },
    runAudit: async (options) => {
      calls.push(`run:${options.manifestLocation}`);
      return buildCompletedResult({
        manifestHash: "b".repeat(64)
      });
    }
  });

  assert.deepEqual(calls, [
    "load",
    "request:0xabc:0",
    "run:https://example.com/manifest.json",
    "evidence:0xabc:0",
    "persist:0xabc:0"
  ]);
  assert.equal(processed.event.eventKey, "0xabc:0");
  assert.equal(processed.auditResult.status, "completed");
  assert.equal(processed.reportPersistence.reportFileName, "1.json");
  assert.equal(processed.reportPersistence.reportFilePath, "/tmp/reports/1.json");
  assert.ok(processed.evidence);
  assert.equal(processed.evidencePersistence?.evidenceFileName, "1.evidence.json");
  assert.equal(processed.evidencePersistence?.evidenceFilePath, "/tmp/evidence/1.evidence.json");
  assert.equal(processed.evidence.eventCount > 0, true);
  assert.equal(processed.evidence.evidenceRoot.length, 64);
  assert.equal(processed.evidence.attestationHash, "0".repeat(64));
  assert.equal(processed.reportArtifact.report.evidence?.evidenceRoot, processed.evidence.evidenceRoot);
  assert.equal(processed.writeback.tokenId, 1n);
  assert.equal(processed.writeback.auditScore, 100);
  assert.equal(processed.writeback.status, "Passed");
  assert.equal(processed.writeback.requestIpCount, 1);
  assert.equal(processed.writeback.manifestHash, "b".repeat(64));
  assert.equal(processed.writeback.evidenceRoot, processed.evidence.evidenceRoot);
  assert.equal(processed.writeback.attestationHash, "0".repeat(64));
  assert.equal(processed.writeback.evidenceCID, "");
  assert.equal(processed.writeback.reportCID, "");
  assert.equal(processed.reportArtifact.reportHash.length, 64);
});

test("processAuditRequested uses an attestation provider and persists the local attestation bundle when configured", async () => {
  const calls: string[] = [];

  const processed = await processAuditRequested(buildEvent(), {
    loadManifestSource: async () => ({
      manifest: {
        agent_name: "risk-agent",
        image: "agent-shenji/test-agent:local",
        allowed_hosts: ["api.risk.com"],
        allowed_rpc_endpoints: ["https://rpc.edge.local"]
      },
      manifestHash: "b".repeat(64),
      sourceContents: "{}"
    }),
    buildAuditRequest: (_event, _manifest) => ({
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    }),
    runAudit: async () => buildCompletedResult({ manifestHash: "b".repeat(64) }),
    createAuditAttestation: async (input) => {
      calls.push(`attest:${input.evidenceRoot}`);
      assert.equal(input.manifestHash, "b".repeat(64));
      return {
        attestationHash: "f".repeat(64),
        bundle: {
          schemaVersion: "audit-attestation.v1",
          eventKey: input.event.eventKey,
          tokenId: input.event.tokenId.toString(),
          manifestHash: input.manifestHash,
          evidenceRoot: input.evidenceRoot,
          verifier: {
            type: "mock-tee",
            measurement: "m".repeat(64),
            quoteFormat: "mock-quote",
            sessionPublicKey: "spk-123",
            quote: "quote-abc"
          }
        },
        bundleJson: JSON.stringify({ ok: true })
      };
    },
    persistAuditAttestation: async (options) => {
      calls.push(`persist-attestation:${options.eventKey}`);
      assert.equal(options.attestationArtifact.attestationHash, "f".repeat(64));
      return buildPersistedAttestation({
        attestationFileName: "1.attestation.json"
      });
    },
    persistAuditReport: async () => buildPersistedReport(),
    persistAuditEvidence: async () => buildPersistedEvidence()
  });

  assert.deepEqual(calls, [
    `attest:${processed.evidence?.evidenceRoot ?? ""}`,
    "persist-attestation:0xabc:0"
  ]);
  assert.equal(processed.evidence?.attestationHash, "f".repeat(64));
  assert.equal(processed.writeback.attestationHash, "f".repeat(64));
  assert.equal(processed.reportArtifact.report.evidence?.attestationHash, "f".repeat(64));
  assert.deepEqual(processed.attestationPersistence, {
    attestationFileName: "1.attestation.json",
    attestationFilePath: "/tmp/attestations/1.attestation.json",
    attestationHash: "f".repeat(64)
  });
});

test("processAuditRequested returns a manifest mismatch failure without running the sandbox", async () => {
  const calls: string[] = [];

  const processed = await processAuditRequested(buildEvent(), {
    loadManifestSource: async () => {
      calls.push("load");
      return {
        manifest: {
          agent_name: "another-agent",
          image: "agent-shenji/test-agent:local",
          allowed_hosts: ["api.risk.com"],
          allowed_rpc_endpoints: ["https://rpc.edge.local"]
        },
        manifestHash: "c".repeat(64),
        sourceContents: "{}"
      };
    },
    persistAuditReport: async (options: PersistAuditReportOptions) => {
      calls.push(`persist:${options.event.eventKey}`);
      return buildPersistedReport({
        reportFileName: `${options.event.tokenId.toString()}-mismatch.json`
      });
    },
    buildAuditRequest: (_event, _manifest) => {
      calls.push("request");
      return {
        task_id: "task-123",
        question: "question",
        context: { history: [] },
        constraints: { response_format: "json" }
      };
    },
    runAudit: async () => {
      calls.push("run");
      return buildCompletedResult();
    }
  });

  assert.deepEqual(calls, ["load", "persist:0xabc:0"]);
  assert.equal(processed.auditResult.status, "failed");
  assert.equal(processed.auditResult.reasonCode, "MANIFEST_NAME_MISMATCH");
  assert.equal(processed.reportPersistence.reportFileName, "1-mismatch.json");
  assert.equal(processed.reportPersistence.reportFilePath, "/tmp/reports/1-mismatch.json");
  assert.equal(processed.writeback.auditScore, 0);
  assert.equal(processed.writeback.status, "Failed");
  assert.equal(processed.writeback.manifestHash, "c".repeat(64));
  assert.equal(processed.reportArtifact.report.reasonCode, "MANIFEST_NAME_MISMATCH");
});

test("processAuditRequested maps a failed audit result into a zero-score writeback", async () => {
  const processed = await processAuditRequested(buildEvent(), {
    loadManifestSource: async () => ({
      manifest: {
        agent_name: "risk-agent",
        image: "agent-shenji/test-agent:local",
        allowed_hosts: ["api.risk.com"],
        allowed_rpc_endpoints: ["https://rpc.edge.local"]
      },
      manifestHash: "d".repeat(64),
      sourceContents: "{}"
    }),
    persistAuditReport: async () => buildPersistedReport({
      reportFileName: "failed-result.json"
    }),
    buildAuditRequest: (_event, _manifest) => ({
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    }),
    runAudit: async () =>
      buildCompletedResult({
        manifestHash: "d".repeat(64),
        status: "failed",
        reasonCode: "REQUEST_TIMEOUT",
        requestCount: 0,
        requestedIps: [],
        requestedHosts: [],
        answer: "",
        actions: []
      })
  });

  assert.equal(processed.writeback.auditScore, 0);
  assert.equal(processed.writeback.status, "Failed");
  assert.equal(processed.writeback.requestIpCount, 0);
  assert.equal(processed.reportPersistence.reportFileName, "failed-result.json");
  assert.equal(processed.reportPersistence.reportFilePath, "/tmp/reports/failed-result.json");
  assert.equal(processed.reportArtifact.report.reasonCode, "REQUEST_TIMEOUT");
});

test("processAuditRequested treats a completed audit result with a reasonCode as failed writeback output", async () => {
  const processed = await processAuditRequested(buildEvent(), {
    loadManifestSource: async () => ({
      manifest: {
        agent_name: "risk-agent",
        image: "agent-shenji/test-agent:local",
        allowed_hosts: ["api.risk.com"],
        allowed_rpc_endpoints: ["https://rpc.edge.local"]
      },
      manifestHash: "e".repeat(64),
      sourceContents: "{}"
    }),
    persistAuditReport: async () => buildPersistedReport({
      reportFileName: "completed-with-reason.json"
    }),
    buildAuditRequest: (_event, _manifest) => ({
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    }),
    runAudit: async () =>
      buildCompletedResult({
        manifestHash: "e".repeat(64),
        status: "completed",
        reasonCode: "ACTION_MISMATCH"
      })
  });

  assert.equal(processed.auditResult.status, "completed");
  assert.equal(processed.auditResult.reasonCode, "ACTION_MISMATCH");
  assert.equal(processed.reportPersistence.reportFileName, "completed-with-reason.json");
  assert.equal(processed.reportPersistence.reportFilePath, "/tmp/reports/completed-with-reason.json");
  assert.equal(processed.writeback.auditScore, 0);
  assert.equal(processed.writeback.status, "Failed");
});

test("processAuditRequested stores the persisted report remotely and returns the report CID", async () => {
  const calls: string[] = [];
  const reportPath = "/tmp/reports/remote-report.json";

  const processed = await processAuditRequested(buildEvent(), {
    loadManifestSource: async () => {
      calls.push("load");
      return {
        manifest: {
          agent_name: "risk-agent",
          image: "agent-shenji/test-agent:local",
          allowed_hosts: ["api.risk.com"],
          allowed_rpc_endpoints: ["https://rpc.edge.local"]
        } satisfies SandboxManifest,
        manifestHash: "f".repeat(64),
        sourceContents: "{}"
      };
    },
    persistAuditReport: async (options: PersistAuditReportOptions) => {
      calls.push(`persist:${options.event.eventKey}`);
      return buildPersistedReport({
        reportFileName: `${options.event.tokenId.toString()}-remote.json`,
        reportFilePath: reportPath
      });
    },
    storePersistedAuditReport: async (options: StorePersistedAuditReportOptions) => {
      calls.push(`store:${options.reportPersistence.reportFilePath}`);
      assert.equal(options.reportPersistence.reportFilePath, reportPath);
      return {
        reportCid: "bafybeigdyrzt",
        cosObjectKey: "reports/1/0xabc-0/f.json"
      };
    },
    buildAuditRequest: (event, _manifest) => {
      calls.push(`request:${event.eventKey}`);
      return {
        task_id: "task-123",
        question: "question",
        context: { history: [] },
        constraints: { response_format: "json" }
      };
    },
    runAudit: async (options) => {
      calls.push(`run:${options.manifestLocation}`);
      return buildCompletedResult({
        manifestHash: "f".repeat(64)
      });
    }
  });

  assert.deepEqual(calls, [
    "load",
    "request:0xabc:0",
    "run:https://example.com/manifest.json",
    "persist:0xabc:0",
    `store:${reportPath}`
  ]);
  assert.equal(processed.reportPersistence.reportFilePath, reportPath);
  assert.equal(processed.writeback.reportCID, "bafybeigdyrzt");
});

test("processAuditRequested maps remote storage failures to a retryable infrastructure failure", async () => {
  const processed = await processAuditRequested(buildEvent(), {
    loadManifestSource: async () => ({
      manifest: {
        agent_name: "risk-agent",
        image: "agent-shenji/test-agent:local",
        allowed_hosts: ["api.risk.com"],
        allowed_rpc_endpoints: ["https://rpc.edge.local"]
      },
      manifestHash: "f".repeat(64),
      sourceContents: "{}"
    }),
    persistAuditReport: async () =>
      buildPersistedReport({
        reportFileName: "storage-failure.json"
      }),
    storePersistedAuditReport: async (_options: StorePersistedAuditReportOptions) => {
      throw new Error("storage unavailable");
    },
    buildAuditRequest: (_event, _manifest) => ({
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    }),
    runAudit: async () =>
      buildCompletedResult({
        manifestHash: "f".repeat(64)
      })
  });

  assert.equal(processed.auditResult.reasonCode, "REPORT_STORAGE_FAILED");
  assert.equal(processed.auditResult.status, "failed");
  assert.equal(isRetryableAuditExecutionFailure(processed), true);
  assert.equal(processed.writeback.reportCID, "");
  assert.deepEqual((processed as { reportStorage?: unknown }).reportStorage, {
    outcome: "failed",
    error: "Error: storage unavailable",
    originalAuditStatus: "completed",
    originalAuditReasonCode: null
  });
});

test("processAuditRequested preserves the original audit failure metadata when remote storage fails after a failed audit", async () => {
  const processed = await processAuditRequested(buildEvent(), {
    loadManifestSource: async () => ({
      manifest: {
        agent_name: "risk-agent",
        image: "agent-shenji/test-agent:local",
        allowed_hosts: ["api.risk.com"],
        allowed_rpc_endpoints: ["https://rpc.edge.local"]
      },
      manifestHash: "f".repeat(64),
      sourceContents: "{}"
    }),
    persistAuditReport: async () =>
      buildPersistedReport({
        reportFileName: "storage-failure-after-audit-failure.json"
      }),
    storePersistedAuditReport: async () => {
      throw new Error("ipfs unavailable");
    },
    buildAuditRequest: (_event, _manifest) => ({
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    }),
    runAudit: async () =>
      buildCompletedResult({
        manifestHash: "f".repeat(64),
        status: "failed",
        reasonCode: "REQUEST_TIMEOUT",
        requestCount: 0,
        requestedIps: [],
        requestedHosts: [],
        answer: "",
        actions: []
      })
  });

  assert.equal(processed.auditResult.reasonCode, "REPORT_STORAGE_FAILED");
  assert.equal(processed.auditResult.status, "failed");
  assert.deepEqual((processed as { reportStorage?: unknown }).reportStorage, {
    outcome: "failed",
    error: "Error: ipfs unavailable",
    originalAuditStatus: "failed",
    originalAuditReasonCode: "REQUEST_TIMEOUT"
  });
});

test("processAuditRequested rejects when report persistence fails", async () => {
  await assert.rejects(
    () =>
      processAuditRequested(buildEvent(), {
        loadManifestSource: async () => ({
          manifest: {
            agent_name: "risk-agent",
            image: "agent-shenji/test-agent:local",
            allowed_hosts: ["api.risk.com"],
            allowed_rpc_endpoints: ["https://rpc.edge.local"]
          },
          manifestHash: "f".repeat(64),
          sourceContents: "{}"
        }),
        persistAuditReport: async () => {
          throw new Error("disk full");
        },
        buildAuditRequest: (_event, _manifest) => ({
          task_id: "task-123",
          question: "question",
          context: { history: [] },
          constraints: { response_format: "json" }
        }),
        runAudit: async () =>
          buildCompletedResult({
            manifestHash: "f".repeat(64)
          })
      }),
    /disk full/
  );
});

test("processAuditRequested supports async buildAuditRequest and passes the loaded manifest", async () => {
  const receivedManifests: SandboxManifest[] = [];
  const manifest: SandboxManifest = {
    agent_name: "risk-agent",
    image: "agent-shenji/test-agent:local",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  };

  const processed = await processAuditRequested(buildEvent(), {
    loadManifestSource: async () => ({
      manifest,
      manifestHash: "b".repeat(64),
      sourceContents: "{}"
    }),
    persistAuditReport: async () => buildPersistedReport(),
    buildAuditRequest: async (event, m) => {
      receivedManifests.push(m);
      return {
        task_id: `async-${event.eventKey}`,
        question: "async question",
        context: { history: [] },
        constraints: { response_format: "json" }
      };
    },
    runAudit: async () => buildCompletedResult({ manifestHash: "b".repeat(64) })
  });

  assert.equal(receivedManifests.length, 1);
  assert.deepEqual(receivedManifests[0], manifest);
  assert.equal(processed.auditResult.status, "completed");
});
