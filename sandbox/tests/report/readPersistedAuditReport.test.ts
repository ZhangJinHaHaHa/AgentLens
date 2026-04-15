import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

import { persistAuditReport } from "../../src/report/persistAuditReport";
import { computeAuditReportHash } from "../../src/report/buildAuditReport";
import { readPersistedAuditReport } from "../../src/report/readPersistedAuditReport";
import type { AuditReportArtifact } from "../../src/report/buildAuditReport";
import type { AuditRequestedEvent } from "../../src/listener/types";

const buildEvent = (overrides: Partial<AuditRequestedEvent> = {}): AuditRequestedEvent => ({
  eventKey: "0xabc:0",
  tokenId: 1n,
  developer: "dev",
  agentName: "agent",
  manifestUrl: "http://example.com/manifest",
  blockNumber: 123,
  transactionHash: "0xabc123",
  ...overrides
});

const buildReportArtifact = (reportJson = "{}"): AuditReportArtifact => ({
  reportHash: computeAuditReportHash(reportJson),
  report: {
    schemaVersion: "audit-report.v1",
    agentName: "agent",
    manifestHash: "manifest",
    status: "completed",
    decisionType: "undetermined",
    healthcheckPassed: true,
    resourceMetrics: { cpuAvgMilli: 1, memoryPeakMb: 1 },
    networkActivity: { requestedIps: [], requestedHosts: [], requestCount: 0 },
    responseTrace: { answer: "ok", actions: [] },
    timestamps: { startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() }
  },
  reportJson
});

test("readPersistedAuditReport returns verified for one matching report with matching bytes", async () => {
  const baseDir = await mkdtemp(`${tmpdir()}${sep}audit-reports-`);
  const event = buildEvent();
  const reportArtifact = buildReportArtifact('{"ok":true}');
  const persisted = await persistAuditReport({ event, reportArtifact, baseDir });

  const result = await readPersistedAuditReport({ eventKey: event.eventKey, baseDir });

  assert.deepEqual(result, {
    status: "verified",
    eventKey: event.eventKey,
    reportFilePath: persisted.reportFilePath,
    reportHash: reportArtifact.reportHash
  });
});

test("readPersistedAuditReport returns not_found when no persisted report matches eventKey", async () => {
  const baseDir = await mkdtemp(`${tmpdir()}${sep}audit-reports-`);

  const result = await readPersistedAuditReport({ eventKey: "0xabc:9", baseDir });

  assert.deepEqual(result, {
    status: "not_found",
    eventKey: "0xabc:9"
  });
});

test("readPersistedAuditReport returns hash_mismatch when report bytes do not match filename hash", async () => {
  const baseDir = await mkdtemp(`${tmpdir()}${sep}audit-reports-`);
  const event = buildEvent();
  const persisted = await persistAuditReport({
    event,
    reportArtifact: buildReportArtifact('{"ok":true}'),
    baseDir
  });
  const tamperedJson = '{"ok":false}';
  await writeFile(persisted.reportFilePath, tamperedJson, "utf8");

  const result = await readPersistedAuditReport({ eventKey: event.eventKey, baseDir });

  assert.deepEqual(result, {
    status: "hash_mismatch",
    eventKey: event.eventKey,
    reportFilePath: persisted.reportFilePath,
    expectedReportHash: buildReportArtifact('{"ok":true}').reportHash,
    actualReportHash: computeAuditReportHash(tamperedJson)
  });
});

test("readPersistedAuditReport returns conflict when multiple reports match one eventKey", async () => {
  const baseDir = await mkdtemp(`${tmpdir()}${sep}audit-reports-`);
  const eventKey = "0xabc:0";
  const first = await persistAuditReport({
    event: buildEvent({ eventKey, tokenId: 1n }),
    reportArtifact: buildReportArtifact('{"id":1}'),
    baseDir
  });
  const second = await persistAuditReport({
    event: buildEvent({ eventKey, tokenId: 2n }),
    reportArtifact: buildReportArtifact('{"id":2}'),
    baseDir
  });

  const result = await readPersistedAuditReport({ eventKey, baseDir });

  assert.deepEqual(result, {
    status: "conflict",
    eventKey,
    matches: [first.reportFilePath, second.reportFilePath].sort()
  });
});

test("readPersistedAuditReport rejects malformed eventKey at API boundary", async () => {
  const baseDir = await mkdtemp(`${tmpdir()}${sep}audit-reports-`);
  await assert.rejects(
    () => readPersistedAuditReport({ eventKey: "bad-key", baseDir }),
    /eventKey must match/
  );
});

