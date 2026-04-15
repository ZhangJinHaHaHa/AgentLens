import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

import { persistAuditReport } from "../../src/report/persistAuditReport";
import type { AuditReportArtifact } from "../../src/report/buildAuditReport";
import type { AuditRequestedEvent } from "../../src/listener/types";

const buildEvent = (): AuditRequestedEvent => ({
  eventKey: "0xabc:0",
  tokenId: 1n,
  developer: "dev",
  agentName: "agent",
  manifestUrl: "http://example.com/manifest",
  blockNumber: 123,
  transactionHash: "0xabc123"
});

const buildReportArtifact = (): AuditReportArtifact => ({
  reportHash: "b".repeat(64),
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
  reportJson: "{}"
});

test("persistAuditReport writes reportJson to a deterministic local file", async () => {
  const baseDir = await mkdtemp(`${tmpdir()}${sep}audit-reports-`);
  const nestedBase = join(baseDir, "nested", "reports");
  const artifact = buildReportArtifact();
  const result = await persistAuditReport({
    event: buildEvent(),
    reportArtifact: artifact,
    baseDir: nestedBase
  });

  assert.match(result.reportFileName, /^1-0xabc-0-b{64}\.json$/);
  assert.equal(resolve(result.reportFilePath), result.reportFilePath);
  assert.equal(await readFile(result.reportFilePath, "utf8"), artifact.reportJson);
});

test("persistAuditReport reuses an existing identical file", async () => {
  const baseDir = await mkdtemp(`${tmpdir()}${sep}audit-reports-`);
  const artifact = buildReportArtifact();
  const first = await persistAuditReport({
    event: buildEvent(),
    reportArtifact: artifact,
    baseDir
  });
  const second = await persistAuditReport({
    event: buildEvent(),
    reportArtifact: artifact,
    baseDir
  });

  assert.equal(first.reportFilePath, second.reportFilePath);
  assert.equal(await readFile(second.reportFilePath, "utf8"), artifact.reportJson);
});

test("persistAuditReport throws when file exists with conflicting bytes", async () => {
  const baseDir = await mkdtemp(`${tmpdir()}${sep}audit-reports-`);
  const artifact = buildReportArtifact();
  const fileName = `1-0xabc-0-${artifact.reportHash}.json`;
  const filePath = join(baseDir, fileName);
  await writeFile(filePath, "different", { encoding: "utf8" });

  await assert.rejects(
    () =>
      persistAuditReport({
        event: buildEvent(),
        reportArtifact: artifact,
        baseDir
      }),
    /report file conflict/
  );
});

test("persistAuditReport rejects invalid eventKey", async () => {
  const baseDir = await mkdtemp(`${tmpdir()}${sep}audit-reports-`);
  await assert.rejects(() =>
    persistAuditReport({
      event: { ...buildEvent(), eventKey: "invalid key" },
      reportArtifact: buildReportArtifact(),
      baseDir
    }),
    /eventKey must match/
  );
});

test("persistAuditReport returns absolute reportFilePath by default", async () => {
  const result = await persistAuditReport({
    event: buildEvent(),
    reportArtifact: buildReportArtifact()
  });

  try {
    assert.equal(resolve(result.reportFilePath), result.reportFilePath);
  } finally {
    await rm(result.reportFilePath, { force: true });
  }
});
