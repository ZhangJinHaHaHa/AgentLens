import test from "node:test";
import assert from "node:assert/strict";

import { createInMemoryEventDeduper } from "../../src/listener/inMemoryEventDeduper";
import { buildAuditReport } from "../../src/report/buildAuditReport";
import type { PersistedAuditReportArtifact } from "../../src/report/persistAuditReport";
import { runAuditRequestedListenerOnce } from "../../src/listener/runAuditRequestedListener";
import type { AuditRequestedEvent, ProcessedAuditRequested } from "../../src/listener/types";
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

function buildProcessed(event: AuditRequestedEvent): ProcessedAuditRequested {
  const auditResult = buildAuditResult();
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
      auditScore: 100,
      memoryPeakMb: 256,
      cpuAvgMilli: 120,
      requestIpCount: 1,
      status: "Passed",
      manifestHash: "a".repeat(64),
      reportHash: "b".repeat(64),
      reportCID: "",
      manifestUrl: event.manifestUrl
    }
  };
}

test("runAuditRequestedListenerOnce dedupes a polled batch, processes unseen events, and advances the block cursor", async () => {
  const deduper = createInMemoryEventDeduper();
  const processedKeys: string[] = [];
  const writebackKeys: string[] = [];
  const firstEvent = buildEvent();
  const secondEvent = buildEvent({
    eventKey: "0xdef:1",
    tokenId: 2n,
    transactionHash: "0xdef",
    blockNumber: 124
  });

  const result = await runAuditRequestedListenerOnce({
    fromBlock: 123,
    deduper,
    getLatestBlockNumber: async () => 124,
    pollAuditRequestedLogs: async ({ fromBlock, toBlock }: { fromBlock: number; toBlock: number }) => {
      assert.equal(fromBlock, 123);
      assert.equal(toBlock, 124);
      return [firstEvent, firstEvent, secondEvent];
    },
    processAuditRequested: async (event: AuditRequestedEvent) => {
      processedKeys.push(event.eventKey);
      return buildProcessed(event);
    },
    writeAuditResult: async (processed: ProcessedAuditRequested) => {
      writebackKeys.push(processed.event.eventKey);
    }
  });

  assert.deepEqual(processedKeys, ["0xabc:0", "0xdef:1"]);
  assert.deepEqual(writebackKeys, ["0xabc:0", "0xdef:1"]);
  assert.equal(result.processed.length, 2);
  assert.equal(result.latestBlockNumber, 124);
  assert.equal(result.nextBlock, 125);
});

test("runAuditRequestedListenerOnce does not move the cursor backwards when the chain head is behind the requested start block", async () => {
  const result = await runAuditRequestedListenerOnce({
    fromBlock: 200,
    deduper: createInMemoryEventDeduper(),
    getLatestBlockNumber: async () => 199,
    pollAuditRequestedLogs: async () => {
      throw new Error("pollAuditRequestedLogs should not run when there are no new blocks");
    },
    processAuditRequested: async () => {
      throw new Error("processAuditRequested should not run when there are no new blocks");
    }
  });

  assert.equal(result.processed.length, 0);
  assert.equal(result.latestBlockNumber, 199);
  assert.equal(result.nextBlock, 200);
});

test("runAuditRequestedListenerOnce still processes unseen events when writeback callback is not configured", async () => {
  const event = buildEvent({
    eventKey: "0xaaa:2",
    tokenId: 3n,
    transactionHash: "0xaaa",
    blockNumber: 130
  });
  const processedKeys: string[] = [];
  const result = await runAuditRequestedListenerOnce({
    fromBlock: 130,
    deduper: createInMemoryEventDeduper(),
    getLatestBlockNumber: async () => 130,
    pollAuditRequestedLogs: async ({ fromBlock, toBlock }: { fromBlock: number; toBlock: number }) => {
      assert.equal(fromBlock, 130);
      assert.equal(toBlock, 130);
      return [event];
    },
    processAuditRequested: async (input: AuditRequestedEvent) => {
      processedKeys.push(input.eventKey);
      return buildProcessed(input);
    }
  });

  assert.deepEqual(processedKeys, ["0xaaa:2"]);
  assert.equal(result.processed.length, 1);
  assert.equal(result.latestBlockNumber, 130);
  assert.equal(result.nextBlock, 131);
});

test("runAuditRequestedListenerOnce emits task lifecycle events for received, duplicate-skipped, started, and processed stages", async () => {
  const deduper = createInMemoryEventDeduper();
  const events: Array<Record<string, unknown>> = [];
  const firstEvent = buildEvent();
  const secondEvent = buildEvent({
    eventKey: "0xdef:1",
    tokenId: 2n,
    transactionHash: "0xdef",
    blockNumber: 124
  });

  await runAuditRequestedListenerOnce({
    fromBlock: 123,
    deduper,
    getLatestBlockNumber: async () => 124,
    pollAuditRequestedLogs: async () => [firstEvent, firstEvent, secondEvent],
    processAuditRequested: async (event: AuditRequestedEvent) => buildProcessed(event),
    emitLifecycleEvent: (event: Record<string, unknown>) => {
      events.push(event);
    }
  });

  assert.deepEqual(
    events.map((event) => event.type),
    [
      "listener-task-received",
      "listener-task-started",
      "listener-task-processed",
      "listener-task-received",
      "listener-task-duplicate-skipped",
      "listener-task-received",
      "listener-task-started",
      "listener-task-processed"
    ]
  );
  assert.ok(events.some((event) => event.type === "listener-task-processed" && event.eventKey === "0xabc:0"));
  assert.ok(events.some((event) => event.type === "listener-task-duplicate-skipped" && event.eventKey === "0xabc:0"));
  assert.ok(events.some((event) => event.type === "listener-task-processed" && event.eventKey === "0xdef:1"));
});

test("runAuditRequestedListenerOnce emits a failed lifecycle event and rethrows when task processing fails", async () => {
  const event = buildEvent({
    eventKey: "0xfff:9",
    tokenId: 9n,
    transactionHash: "0xfff",
    blockNumber: 140
  });
  const lifecycleEvents: Array<Record<string, unknown>> = [];

  await assert.rejects(
    runAuditRequestedListenerOnce({
      fromBlock: 140,
      deduper: createInMemoryEventDeduper(),
      getLatestBlockNumber: async () => 140,
      pollAuditRequestedLogs: async () => [event],
      processAuditRequested: async () => {
        throw new Error("manifest download failed");
      },
      emitLifecycleEvent: (payload: Record<string, unknown>) => {
        lifecycleEvents.push(payload);
      }
    }),
    /manifest download failed/
  );

  assert.deepEqual(
    lifecycleEvents.map((payload) => payload.type),
    ["listener-task-received", "listener-task-started", "listener-task-failed"]
  );
  assert.ok(
    lifecycleEvents.some(
      (payload) =>
        payload.type === "listener-task-failed" &&
        payload.eventKey === "0xfff:9" &&
        payload.error === "Error: manifest download failed"
    )
  );
});
