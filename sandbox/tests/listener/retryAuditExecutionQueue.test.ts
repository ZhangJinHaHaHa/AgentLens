import test from "node:test";
import assert from "node:assert/strict";

import {
  createAuditExecutionRetryItem,
  flushAuditExecutionRetryQueue,
  isRetryableAuditExecutionFailure
} from "../../src/listener/retryAuditExecutionQueue";
import { buildAuditReport } from "../../src/report/buildAuditReport";
import type { PersistedAuditReportArtifact } from "../../src/report/persistAuditReport";
import type {
  AuditRequestedEvent,
  ListenerAuditExecutionRetryItem,
  ProcessedAuditRequested
} from "../../src/listener/types";
import type { LocalAuditResult } from "../../src/types/manifest";

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

function buildAuditResult(overrides: Partial<LocalAuditResult> = {}): LocalAuditResult {
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

function buildProcessed(
  event: AuditRequestedEvent = buildEvent(),
  auditResult: LocalAuditResult = buildAuditResult()
): ProcessedAuditRequested {
  const reportPersistence: PersistedAuditReportArtifact = {
    reportFileName: "persisted-report.json",
    reportFilePath: "/tmp/reports/persisted-report.json"
  };

  return {
    event,
    auditResult,
    reportArtifact: buildAuditReport(auditResult),
    reportPersistence,
    writeback: {
      tokenId: event.tokenId,
      auditScore: auditResult.status === "completed" ? 100 : 0,
      memoryPeakMb: auditResult.memoryPeakMb,
      cpuAvgMilli: auditResult.cpuAvgMilli,
      requestIpCount: auditResult.requestCount,
      status: auditResult.status === "completed" ? "Passed" : "Failed",
      manifestHash: auditResult.manifestHash,
      reportHash: "b".repeat(64),
      reportCID: "",
      manifestUrl: event.manifestUrl
    }
  };
}

test("isRetryableAuditExecutionFailure returns true only for whitelisted transient failure codes", () => {
  const retryable = buildProcessed(
    buildEvent(),
    buildAuditResult({
      status: "failed",
      reasonCode: "REQUEST_TIMEOUT",
      answer: "",
      actions: [],
      requestCount: 0,
      requestedIps: [],
      requestedHosts: []
    })
  );
  const nonRetryable = buildProcessed(
    buildEvent(),
    buildAuditResult({
      status: "failed",
      reasonCode: "ACTION_MISMATCH",
      answer: "",
      actions: [],
      requestCount: 0,
      requestedIps: [],
      requestedHosts: []
    })
  );
  const storageFailure = buildProcessed(
    buildEvent(),
    buildAuditResult({
      status: "failed",
      reasonCode: "REPORT_STORAGE_FAILED",
      answer: "",
      actions: [],
      requestCount: 0,
      requestedIps: [],
      requestedHosts: []
    })
  );

  assert.equal(isRetryableAuditExecutionFailure(retryable), true);
  assert.equal(isRetryableAuditExecutionFailure(storageFailure), true);
  assert.equal(isRetryableAuditExecutionFailure(nonRetryable), false);
});

test("createAuditExecutionRetryItem captures event details and schedules the first retry", () => {
  const item = createAuditExecutionRetryItem(
    buildProcessed(
      buildEvent(),
      buildAuditResult({
        status: "failed",
        reasonCode: "REQUEST_TIMEOUT",
        answer: "",
        actions: [],
        requestCount: 0,
        requestedIps: [],
        requestedHosts: []
      })
    ),
    new Date("2026-03-28T10:00:00.000Z")
  );

  assert.deepEqual(item, {
    eventKey: "0xabc:0",
    tokenId: "1",
    developer: "0x000000000000000000000000000000000000dEaD",
    agentName: "risk-agent",
    manifestUrl: "https://example.com/manifest.json",
    blockNumber: 123,
    transactionHash: "0xabc",
    attemptCount: 1,
    lastAttemptAt: "2026-03-28T10:00:00.000Z",
    nextAttemptAt: "2026-03-28T10:00:10.000Z",
    lastReasonCode: "REQUEST_TIMEOUT",
    lastError: "retryable audit execution failure: REQUEST_TIMEOUT"
  });
});

test("flushAuditExecutionRetryQueue reprocesses due items and reschedules retryable failures", async () => {
  const updates: ListenerAuditExecutionRetryItem[] = [];
  const item: ListenerAuditExecutionRetryItem = {
    eventKey: "0xabc:0",
    tokenId: "1",
    developer: "0x000000000000000000000000000000000000dEaD",
    agentName: "risk-agent",
    manifestUrl: "https://example.com/manifest.json",
    blockNumber: 123,
    transactionHash: "0xabc",
    attemptCount: 1,
    lastAttemptAt: "2026-03-28T10:00:00.000Z",
    nextAttemptAt: "2026-03-28T10:00:10.000Z",
    lastReasonCode: "REQUEST_TIMEOUT",
    lastError: "retryable audit execution failure: REQUEST_TIMEOUT"
  };

  const results = await flushAuditExecutionRetryQueue({
    state: {
      readAuditExecutionRetryQueue: async () => [item],
      upsertAuditExecutionRetry: async (next: ListenerAuditExecutionRetryItem) => {
        updates.push(next);
      },
      removeAuditExecutionRetry: async () => {
        throw new Error("should not remove on retryable failure");
      }
    },
    processAuditRequested: async () =>
      buildProcessed(
        buildEvent(),
        buildAuditResult({
          status: "failed",
          reasonCode: "AGENT_UNAVAILABLE",
          answer: "",
          actions: [],
          requestCount: 0,
          requestedIps: [],
          requestedHosts: []
        })
      ),
    now: () => new Date("2026-03-28T10:00:10.000Z")
  });

  assert.deepEqual(results, [
    {
      eventKey: "0xabc:0",
      outcome: "retry-scheduled",
      tokenId: "1",
      attemptCount: 2,
      nextAttemptAt: "2026-03-28T10:00:40.000Z",
      reasonCode: "AGENT_UNAVAILABLE",
      error: "retryable audit execution failure: AGENT_UNAVAILABLE"
    }
  ]);
  assert.deepEqual(updates, [
    {
      ...item,
      attemptCount: 2,
      lastAttemptAt: "2026-03-28T10:00:10.000Z",
      nextAttemptAt: "2026-03-28T10:00:40.000Z",
      lastReasonCode: "AGENT_UNAVAILABLE",
      lastError: "retryable audit execution failure: AGENT_UNAVAILABLE"
    }
  ]);
});

test("flushAuditExecutionRetryQueue removes queued items once they reach a final processed result", async () => {
  const removed: string[] = [];
  const item: ListenerAuditExecutionRetryItem = {
    eventKey: "0xabc:0",
    tokenId: "1",
    developer: "0x000000000000000000000000000000000000dEaD",
    agentName: "risk-agent",
    manifestUrl: "https://example.com/manifest.json",
    blockNumber: 123,
    transactionHash: "0xabc",
    attemptCount: 1,
    lastAttemptAt: "2026-03-28T10:00:00.000Z",
    nextAttemptAt: "2026-03-28T10:00:10.000Z",
    lastReasonCode: "REQUEST_TIMEOUT",
    lastError: "retryable audit execution failure: REQUEST_TIMEOUT"
  };
  const completed = buildProcessed(buildEvent(), buildAuditResult());

  const results = await flushAuditExecutionRetryQueue({
    state: {
      readAuditExecutionRetryQueue: async () => [item],
      upsertAuditExecutionRetry: async () => {
        throw new Error("should not reschedule completed results");
      },
      removeAuditExecutionRetry: async (eventKey: string) => {
        removed.push(eventKey);
      }
    },
    processAuditRequested: async () => completed,
    now: () => new Date("2026-03-28T10:00:10.000Z")
  });

  assert.deepEqual(removed, ["0xabc:0"]);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.outcome, "completed");
  assert.equal(results[0]?.processed?.auditResult.status, "completed");
});
