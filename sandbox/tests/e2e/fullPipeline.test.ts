import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { processAuditRequested } from "../../src/listener/processAuditRequested";
import { writeAuditResult, writeAuditResultSummary } from "../../src/listener/writeAuditResult";
import { readPersistedAuditReport } from "../../src/report/readPersistedAuditReport";
import { readPersistedAuditEvidence } from "../../src/evidence/readPersistedAuditEvidence";
import { readPersistedAuditAttestation } from "../../src/attestation/readPersistedAuditAttestation";
import { persistAuditReport } from "../../src/report/persistAuditReport";
import { persistAuditEvidence } from "../../src/evidence/persistAuditEvidence";
import { persistAuditAttestation } from "../../src/attestation/persistAuditAttestation";
import { buildAuditAttestationArtifact } from "../../src/attestation/buildAuditAttestation";
import { ZERO_EVIDENCE_HASH } from "../../src/evidence/buildAuditEvidenceEvent";
import type { AuditRequestedEvent, ProcessedAuditRequested } from "../../src/listener/types";
import type { AuditSolveRequest, LocalAuditResult, SandboxManifest } from "../../src/types/manifest";
import type { CreateAuditAttestationInput } from "../../src/attestation/buildAuditAttestation";
import type { WriteAuditResultDependencies } from "../../src/listener/writeAuditResult";

const EVENT_KEY = "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678:0";
const TX_HASH = "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678";

function buildTestEvent(overrides: Partial<AuditRequestedEvent> = {}): AuditRequestedEvent {
  return {
    eventKey: EVENT_KEY,
    tokenId: 1n,
    developer: "0x000000000000000000000000000000000000dEaD",
    agentName: "risk-agent",
    manifestUrl: "https://example.com/manifest.json",
    blockNumber: 100,
    transactionHash: TX_HASH,
    ...overrides
  };
}

function buildTestManifest(): SandboxManifest {
  return {
    agent_name: "risk-agent",
    image: "agent-shenji/test-agent:local",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  };
}

function buildTestAuditResult(
  overrides: Partial<LocalAuditResult> = {}
): LocalAuditResult {
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
    startedAt: "2026-04-11T10:00:00.000Z",
    finishedAt: "2026-04-11T10:00:05.000Z",
    ...overrides
  };
}

function buildTestAuditRequest(): AuditSolveRequest {
  return {
    task_id: "task-e2e-001",
    question: "Is this agent safe?",
    context: { history: [] },
    constraints: { response_format: "json" }
  };
}

function createMockAttestationProvider(): (
  input: CreateAuditAttestationInput
) => Promise<ReturnType<typeof buildAuditAttestationArtifact>> {
  return async (input) => {
    return buildAuditAttestationArtifact({
      schemaVersion: "audit-attestation.v1",
      eventKey: input.event.eventKey,
      tokenId: input.event.tokenId.toString(),
      manifestHash: input.manifestHash,
      evidenceRoot: input.evidenceRoot,
      verifier: {
        type: "mock-tee",
        measurement: "b".repeat(64),
        quoteFormat: "mock-quote",
        sessionPublicKey: "mock-session-public-key-e2e",
        quote: "mock-attestation-quote-e2e"
      }
    });
  };
}

test("full pipeline: event -> process -> evidence -> attestation -> writeback -> verify", async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), "e2e-full-pipeline-"));
  const reportsDir = join(stateDir, "reports");
  const evidenceDir = join(stateDir, "evidence");
  const attestationsDir = join(stateDir, "attestations");

  t.after(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  const event = buildTestEvent();
  const manifest = buildTestManifest();
  const auditResult = buildTestAuditResult();
  const mockAttest = createMockAttestationProvider();
  const lifecycleEvents: string[] = [];

  // Step 1: processAuditRequested -- the core pipeline
  const processed = await processAuditRequested(event, {
    loadManifestSource: async () => ({
      manifest,
      manifestHash: auditResult.manifestHash,
      sourceContents: JSON.stringify(manifest)
    }),
    buildAuditRequest: () => buildTestAuditRequest(),
    runAudit: async ({ emitEvidence }) => {
      lifecycleEvents.push("run-audit");
      if (emitEvidence) {
        await emitEvidence({
          stage: "container_started",
          payload: { image: manifest.image }
        });
        await emitEvidence({
          stage: "healthcheck_passed",
          payload: { url: "/health" }
        });
        await emitEvidence({
          stage: "audit_request_sent",
          payload: { taskId: "task-e2e-001" }
        });
        await emitEvidence({
          stage: "audit_response_received",
          payload: { answer: auditResult.answer }
        });
        await emitEvidence({
          stage: "resource_usage_collected",
          payload: {
            cpuAvgMilli: auditResult.cpuAvgMilli,
            memoryPeakMb: auditResult.memoryPeakMb
          }
        });
        await emitEvidence({
          stage: "network_activity_collected",
          payload: {
            requestedIps: auditResult.requestedIps,
            requestCount: auditResult.requestCount
          }
        });
      }
      return auditResult;
    },
    createAuditAttestation: async (input) => {
      lifecycleEvents.push("create-attestation");
      return mockAttest(input);
    },
    persistAuditEvidence: async (options) => {
      lifecycleEvents.push("persist-evidence");
      return persistAuditEvidence({
        ...options,
        baseDir: evidenceDir
      });
    },
    persistAuditAttestation: async (options) => {
      lifecycleEvents.push("persist-attestation");
      return persistAuditAttestation({
        ...options,
        baseDir: attestationsDir
      });
    },
    persistAuditReport: async (options) => {
      lifecycleEvents.push("persist-report");
      return persistAuditReport({
        ...options,
        baseDir: reportsDir
      });
    }
  });

  // Step 2: Validate processAuditRequested results
  await t.test("processAuditRequested returns correct lifecycle events", () => {
    assert.deepEqual(lifecycleEvents, [
      "run-audit",
      "create-attestation",
      "persist-evidence",
      "persist-attestation",
      "persist-report"
    ]);
  });

  await t.test("processed event matches the original event", () => {
    assert.equal(processed.event.eventKey, EVENT_KEY);
    assert.equal(processed.event.tokenId, 1n);
    assert.equal(processed.event.agentName, "risk-agent");
  });

  await t.test("audit result has passing status and score", () => {
    assert.equal(processed.auditResult.status, "completed");
    assert.equal(processed.writeback.auditScore, 100);
    assert.equal(processed.writeback.status, "Passed");
    assert.equal(processed.writeback.tokenId, 1n);
  });

  await t.test("evidence chain was built with non-zero root", () => {
    assert.ok(processed.evidence, "evidence should be present");
    assert.notEqual(processed.evidence.evidenceRoot, ZERO_EVIDENCE_HASH);
    assert.equal(processed.evidence.evidenceRoot.length, 64);
    assert.ok(processed.evidence.eventCount > 0);
  });

  await t.test("attestation hash was computed and is non-zero", () => {
    assert.ok(processed.evidence, "evidence should be present");
    assert.notEqual(processed.evidence.attestationHash, ZERO_EVIDENCE_HASH);
    assert.equal(processed.evidence.attestationHash.length, 64);
  });

  await t.test("writeback summary has evidence root and attestation hash", () => {
    assert.equal(processed.writeback.evidenceRoot, processed.evidence?.evidenceRoot);
    assert.equal(processed.writeback.attestationHash, processed.evidence?.attestationHash);
  });

  await t.test("report artifact embeds evidence metadata", () => {
    const report = processed.reportArtifact.report;
    assert.ok(report.evidence, "report should include evidence section");
    assert.equal(report.evidence.evidenceRoot, processed.evidence?.evidenceRoot);
    assert.equal(report.evidence.attestationHash, processed.evidence?.attestationHash);
    assert.equal(report.evidence.eventCount, processed.evidence?.eventCount);
  });

  await t.test("evidence persistence artifact was returned", () => {
    assert.ok(processed.evidencePersistence, "evidencePersistence should be present");
    assert.ok(processed.evidencePersistence.evidenceFilePath.length > 0);
    assert.equal(processed.evidencePersistence.evidenceRoot, processed.evidence?.evidenceRoot);
  });

  await t.test("attestation persistence artifact was returned", () => {
    assert.ok(processed.attestationPersistence, "attestationPersistence should be present");
    assert.ok(processed.attestationPersistence.attestationFilePath.length > 0);
    assert.equal(
      processed.attestationPersistence.attestationHash,
      processed.evidence?.attestationHash
    );
  });

  // Step 3: Simulate writeback (mock contract call)
  await t.test("writeAuditResult encodes the correct contract call", async () => {
    let capturedArgs: Record<string, unknown> | undefined;

    const submitContractCall: WriteAuditResultDependencies["submitContractCall"] =
      async (request) => {
        assert.equal(request.method, "recordAuditResult");
        capturedArgs = { ...request.args };
        return {
          transactionHash: "0xwriteback0001",
          blockNumber: 200
        };
      };

    const receipt = await writeAuditResult(processed, { submitContractCall });

    assert.ok(capturedArgs, "contract call should have been made");
    assert.equal(capturedArgs.tokenId, 1n);
    assert.equal(capturedArgs.auditScore, 100);
    assert.equal(capturedArgs.status, 1); // Passed = 1
    assert.equal(capturedArgs.manifestHash, `0x${"a".repeat(64)}`);
    assert.ok(
      typeof capturedArgs.evidenceRoot === "string" &&
        (capturedArgs.evidenceRoot as string).startsWith("0x")
    );
    assert.ok(
      typeof capturedArgs.attestationHash === "string" &&
        (capturedArgs.attestationHash as string).startsWith("0x")
    );
    assert.ok(receipt);
  });

  // Step 4: Verify persisted report
  await t.test("report verify CLI returns verified status", async () => {
    const reportResult = await readPersistedAuditReport({
      eventKey: EVENT_KEY,
      baseDir: reportsDir
    });

    assert.equal(reportResult.status, "verified");
    if (reportResult.status === "verified") {
      assert.equal(reportResult.eventKey, EVENT_KEY);
      assert.ok(reportResult.reportHash.length === 64);
      assert.ok(reportResult.reportFilePath.includes(reportsDir));
    }
  });

  // Step 5: Verify persisted evidence
  await t.test("evidence verify returns verified status", async () => {
    const evidenceResult = await readPersistedAuditEvidence({
      eventKey: EVENT_KEY,
      baseDir: evidenceDir
    });

    assert.equal(evidenceResult.status, "verified");
    if (evidenceResult.status === "verified") {
      assert.equal(evidenceResult.eventKey, EVENT_KEY);
      assert.equal(evidenceResult.evidenceRoot, processed.evidence?.evidenceRoot);
      assert.ok(evidenceResult.evidenceFilePath.includes(evidenceDir));
    }
  });

  // Step 6: Verify persisted attestation
  await t.test("attestation verify returns verified status", async () => {
    const attestationResult = await readPersistedAuditAttestation({
      eventKey: EVENT_KEY,
      baseDir: attestationsDir
    });

    assert.equal(attestationResult.status, "verified");
    if (attestationResult.status === "verified") {
      assert.equal(attestationResult.eventKey, EVENT_KEY);
      assert.equal(
        attestationResult.attestationHash,
        processed.evidence?.attestationHash
      );
      assert.ok(attestationResult.attestationFilePath.includes(attestationsDir));
    }
  });

  // Step 7: Verify attestation bundle content
  await t.test("attestation bundle has correct verifier fields", async () => {
    const attestationResult = await readPersistedAuditAttestation({
      eventKey: EVENT_KEY,
      baseDir: attestationsDir,
      expectedVerifier: {
        providerType: "mock-tee",
        quoteFormat: "mock-quote"
      }
    });

    assert.equal(attestationResult.status, "verified");
  });

  // Step 8: Validate cross-consistency
  await t.test("report hash in writeback matches persisted report hash", async () => {
    const reportResult = await readPersistedAuditReport({
      eventKey: EVENT_KEY,
      baseDir: reportsDir
    });

    assert.equal(reportResult.status, "verified");
    if (reportResult.status === "verified") {
      assert.equal(processed.reportArtifact.reportHash, reportResult.reportHash);
    }
  });

  await t.test("evidence root in writeback matches persisted evidence root", async () => {
    const evidenceResult = await readPersistedAuditEvidence({
      eventKey: EVENT_KEY,
      baseDir: evidenceDir
    });

    assert.equal(evidenceResult.status, "verified");
    if (evidenceResult.status === "verified") {
      assert.equal(processed.writeback.evidenceRoot, evidenceResult.evidenceRoot);
    }
  });

  await t.test("attestation hash in writeback matches persisted attestation hash", async () => {
    const attestationResult = await readPersistedAuditAttestation({
      eventKey: EVENT_KEY,
      baseDir: attestationsDir
    });

    assert.equal(attestationResult.status, "verified");
    if (attestationResult.status === "verified") {
      assert.equal(
        processed.writeback.attestationHash,
        attestationResult.attestationHash
      );
    }
  });

  // Step 9: Verify file structure
  await t.test("state directory contains reports, evidence, and attestations dirs", async () => {
    const reportFiles = await readdir(reportsDir);
    const evidenceFiles = await readdir(evidenceDir);
    const attestationFiles = await readdir(attestationsDir);

    assert.equal(reportFiles.length, 1, "exactly one report file");
    assert.equal(evidenceFiles.length, 1, "exactly one evidence file");
    assert.equal(attestationFiles.length, 1, "exactly one attestation file");

    assert.match(reportFiles[0], /\.json$/);
    assert.match(evidenceFiles[0], /\.json$/);
    assert.match(attestationFiles[0], /\.json$/);
  });
});

test("full pipeline: failed audit produces zero attestation and correct writeback", async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), "e2e-failed-audit-"));
  const reportsDir = join(stateDir, "reports");
  const evidenceDir = join(stateDir, "evidence");

  t.after(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  const event = buildTestEvent();
  const manifest = buildTestManifest();
  const failedResult = buildTestAuditResult({
    status: "failed",
    reasonCode: "REQUEST_TIMEOUT",
    answer: "",
    actions: [],
    requestedIps: [],
    requestedHosts: [],
    requestCount: 0
  });

  const processed = await processAuditRequested(event, {
    loadManifestSource: async () => ({
      manifest,
      manifestHash: failedResult.manifestHash,
      sourceContents: JSON.stringify(manifest)
    }),
    buildAuditRequest: () => buildTestAuditRequest(),
    runAudit: async () => failedResult,
    persistAuditEvidence: async (options) =>
      persistAuditEvidence({ ...options, baseDir: evidenceDir }),
    persistAuditReport: async (options) =>
      persistAuditReport({ ...options, baseDir: reportsDir })
  });

  await t.test("failed audit has zero score", () => {
    assert.equal(processed.writeback.auditScore, 0);
    assert.equal(processed.writeback.status, "Failed");
  });

  await t.test("no attestation was created when provider is not configured", () => {
    assert.equal(processed.evidence?.attestationHash, ZERO_EVIDENCE_HASH);
    assert.equal(processed.attestationPersistence, undefined);
  });

  await t.test("evidence chain was still built for failed audit", () => {
    assert.ok(processed.evidence);
    assert.ok(processed.evidence.eventCount > 0);
    assert.notEqual(processed.evidence.evidenceRoot, ZERO_EVIDENCE_HASH);
  });

  await t.test("report and evidence are verifiable for failed audit", async () => {
    const reportResult = await readPersistedAuditReport({
      eventKey: EVENT_KEY,
      baseDir: reportsDir
    });
    assert.equal(reportResult.status, "verified");

    const evidenceResult = await readPersistedAuditEvidence({
      eventKey: EVENT_KEY,
      baseDir: evidenceDir
    });
    assert.equal(evidenceResult.status, "verified");
  });

  await t.test("writeback summary encodes Failed status correctly", async () => {
    let capturedStatus: number | undefined;

    await writeAuditResult(processed, {
      submitContractCall: async (request) => {
        capturedStatus = request.args.status;
        return { transactionHash: "0xfailed001", blockNumber: 201 };
      }
    });

    assert.equal(capturedStatus, 2); // Failed = 2
  });
});

test("full pipeline: manifest mismatch produces correct output without running audit", async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), "e2e-mismatch-"));
  const reportsDir = join(stateDir, "reports");

  t.after(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  const event = buildTestEvent();
  let auditRunCalled = false;

  const processed = await processAuditRequested(event, {
    loadManifestSource: async () => ({
      manifest: {
        agent_name: "different-agent",
        image: "agent-shenji/test-agent:local",
        allowed_hosts: [],
        allowed_rpc_endpoints: []
      },
      manifestHash: "c".repeat(64),
      sourceContents: "{}"
    }),
    buildAuditRequest: () => buildTestAuditRequest(),
    runAudit: async () => {
      auditRunCalled = true;
      return buildTestAuditResult();
    },
    persistAuditReport: async (options) =>
      persistAuditReport({ ...options, baseDir: reportsDir })
  });

  await t.test("sandbox audit was NOT run for manifest mismatch", () => {
    assert.equal(auditRunCalled, false);
  });

  await t.test("writeback is Failed with MANIFEST_NAME_MISMATCH reason", () => {
    assert.equal(processed.auditResult.reasonCode, "MANIFEST_NAME_MISMATCH");
    assert.equal(processed.writeback.status, "Failed");
    assert.equal(processed.writeback.auditScore, 0);
  });

  await t.test("report is still verifiable after mismatch", async () => {
    const reportResult = await readPersistedAuditReport({
      eventKey: EVENT_KEY,
      baseDir: reportsDir
    });
    assert.equal(reportResult.status, "verified");
  });
});

test("full pipeline: attestation verify rejects mismatched verifier type", async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), "e2e-attest-mismatch-"));
  const attestationsDir = join(stateDir, "attestations");
  const reportsDir = join(stateDir, "reports");
  const evidenceDir = join(stateDir, "evidence");

  t.after(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  const event = buildTestEvent();
  const manifest = buildTestManifest();
  const auditResult = buildTestAuditResult();
  const mockAttest = createMockAttestationProvider();

  await processAuditRequested(event, {
    loadManifestSource: async () => ({
      manifest,
      manifestHash: auditResult.manifestHash,
      sourceContents: JSON.stringify(manifest)
    }),
    buildAuditRequest: () => buildTestAuditRequest(),
    runAudit: async () => auditResult,
    createAuditAttestation: mockAttest,
    persistAuditEvidence: async (options) =>
      persistAuditEvidence({ ...options, baseDir: evidenceDir }),
    persistAuditAttestation: async (options) =>
      persistAuditAttestation({ ...options, baseDir: attestationsDir }),
    persistAuditReport: async (options) =>
      persistAuditReport({ ...options, baseDir: reportsDir })
  });

  const result = await readPersistedAuditAttestation({
    eventKey: EVENT_KEY,
    baseDir: attestationsDir,
    expectedVerifier: {
      providerType: "sgx-dcap"
    }
  });

  assert.equal(result.status, "verifier_mismatch");
  if (result.status === "verifier_mismatch") {
    assert.equal(result.field, "providerType");
    assert.equal(result.expected, "sgx-dcap");
    assert.equal(result.actual, "mock-tee");
  }
});

test("full pipeline: writeAuditResultSummary can submit from serialized writeback data", async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), "e2e-retry-writeback-"));
  const reportsDir = join(stateDir, "reports");

  t.after(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  const event = buildTestEvent();
  const manifest = buildTestManifest();
  const auditResult = buildTestAuditResult();
  const mockAttest = createMockAttestationProvider();

  const processed = await processAuditRequested(event, {
    loadManifestSource: async () => ({
      manifest,
      manifestHash: auditResult.manifestHash,
      sourceContents: JSON.stringify(manifest)
    }),
    buildAuditRequest: () => buildTestAuditRequest(),
    runAudit: async () => auditResult,
    createAuditAttestation: mockAttest,
    persistAuditReport: async (options) =>
      persistAuditReport({ ...options, baseDir: reportsDir })
  });

  // Simulate serializing and deserializing the writeback summary (like retry queue)
  const serialized = JSON.parse(
    JSON.stringify(processed.writeback, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  let capturedCall: Record<string, unknown> | undefined;

  await writeAuditResultSummary(
    {
      ...serialized,
      tokenId: BigInt(serialized.tokenId)
    },
    {
      submitContractCall: async (request) => {
        capturedCall = { method: request.method, tokenId: request.args.tokenId };
        return { transactionHash: "0xretry001", blockNumber: 301 };
      }
    }
  );

  assert.ok(capturedCall);
  assert.equal(capturedCall.method, "recordAuditResult");
  assert.equal(capturedCall.tokenId, 1n);
});

test("full pipeline: evidence file contents have correct schema and chain integrity", async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), "e2e-evidence-integrity-"));
  const evidenceDir = join(stateDir, "evidence");
  const reportsDir = join(stateDir, "reports");

  t.after(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  const event = buildTestEvent();
  const manifest = buildTestManifest();
  const auditResult = buildTestAuditResult();

  const processed = await processAuditRequested(event, {
    loadManifestSource: async () => ({
      manifest,
      manifestHash: auditResult.manifestHash,
      sourceContents: JSON.stringify(manifest)
    }),
    buildAuditRequest: () => buildTestAuditRequest(),
    runAudit: async ({ emitEvidence }) => {
      if (emitEvidence) {
        await emitEvidence({
          stage: "container_started",
          payload: { image: manifest.image }
        });
        await emitEvidence({
          stage: "healthcheck_passed",
          payload: { url: "/health" }
        });
      }
      return auditResult;
    },
    persistAuditEvidence: async (options) =>
      persistAuditEvidence({ ...options, baseDir: evidenceDir }),
    persistAuditReport: async (options) =>
      persistAuditReport({ ...options, baseDir: reportsDir })
  });

  const evidenceFiles = await readdir(evidenceDir);
  assert.equal(evidenceFiles.length, 1);

  const evidenceJson = JSON.parse(
    await readFile(join(evidenceDir, evidenceFiles[0]), "utf8")
  );

  await t.test("evidence file has correct schema version", () => {
    assert.equal(evidenceJson.schemaVersion, "audit-evidence-stream.v1");
  });

  await t.test("evidence file has correct event count", () => {
    assert.equal(evidenceJson.eventCount, evidenceJson.events.length);
    assert.ok(evidenceJson.eventCount >= 5); // at minimum: observed, fetched, validated, container_started, healthcheck_passed, report_built
  });

  await t.test("evidence events form a hash chain (prevHash links)", () => {
    const events = evidenceJson.events;
    assert.equal(events[0].prevHash, ZERO_EVIDENCE_HASH);
    for (let i = 1; i < events.length; i += 1) {
      assert.equal(
        events[i].prevHash,
        events[i - 1].eventHash,
        `event ${i} prevHash should equal event ${i - 1} eventHash`
      );
    }
  });

  await t.test("evidence root matches the last event hash", () => {
    const events = evidenceJson.events;
    assert.equal(evidenceJson.evidenceRoot, events[events.length - 1].eventHash);
    assert.equal(processed.evidence?.evidenceRoot, evidenceJson.evidenceRoot);
  });

  await t.test("all evidence events have audit-evidence.v1 schema", () => {
    for (const ev of evidenceJson.events) {
      assert.equal(ev.schemaVersion, "audit-evidence.v1");
      assert.equal(ev.eventKey, EVENT_KEY);
      assert.equal(ev.tokenId, "1");
    }
  });

  await t.test("evidence stages appear in correct order", () => {
    const stages = evidenceJson.events.map(
      (ev: { stage: string }) => ev.stage
    );
    assert.ok(stages.includes("audit_requested_observed"));
    assert.ok(stages.includes("manifest_fetched"));
    assert.ok(stages.includes("manifest_validated"));
    assert.ok(stages.includes("container_started"));
    assert.ok(stages.includes("healthcheck_passed"));
    assert.ok(stages.includes("report_built"));

    const observedIdx = stages.indexOf("audit_requested_observed");
    const builtIdx = stages.indexOf("report_built");
    assert.ok(observedIdx < builtIdx, "audit_requested_observed should come before report_built");
  });
});
