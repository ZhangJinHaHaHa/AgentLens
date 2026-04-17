import test from "node:test";
import assert from "node:assert/strict";

import { buildAuditReport } from "../../src/report/buildAuditReport";
import { createInMemoryEventDeduper } from "../../src/listener/inMemoryEventDeduper";
import { evaluateSlashDecision } from "../../src/listener/slashPolicy";
import {
  createSlashRetryItem,
  flushSlashRetryQueue
} from "../../src/listener/retrySlashQueue";
import { runAuditRequestedListenerOnce } from "../../src/listener/runAuditRequestedListener";
import type {
  PostWritebackSlashRequest,
  ListenerTaskLifecycleEvent
} from "../../src/listener/runAuditRequestedListener";
import type {
  AuditRequestedEvent,
  AuditWritebackSummary,
  ListenerSlashRetryItem,
  ProcessedAuditRequested
} from "../../src/listener/types";
import type { PersistedAuditReportArtifact } from "../../src/report/persistAuditReport";
import type { LocalAuditResult } from "../../src/types/manifest";
import type { WriteSlashBondRequest } from "../../src/listener/writeSlashBond";

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

function buildWriteback(
  event: AuditRequestedEvent,
  overrides: Partial<AuditWritebackSummary> = {}
): AuditWritebackSummary {
  return {
    tokenId: event.tokenId,
    auditScore: 100,
    memoryPeakMb: 256,
    cpuAvgMilli: 120,
    requestIpCount: 1,
    status: "Passed",
    manifestHash: "a".repeat(64),
    reportHash: "b".repeat(64),
    reportCID: "",
    manifestUrl: event.manifestUrl,
    ...overrides
  };
}

function buildProcessed(
  event: AuditRequestedEvent,
  auditResult: LocalAuditResult,
  writebackOverrides: Partial<AuditWritebackSummary> = {}
): ProcessedAuditRequested {
  const reportPersistence: PersistedAuditReportArtifact = {
    reportFileName: "report.json",
    reportFilePath: "/tmp/reports/report.json"
  };

  return {
    event,
    auditResult,
    reportArtifact: buildAuditReport(auditResult),
    reportPersistence,
    writeback: buildWriteback(event, writebackOverrides)
  };
}

test("E2E scenario 1: audit fails with UNDECLARED_EGRESS -> slash is triggered after writeback", async () => {
  const event = buildEvent();
  const auditResult = buildAuditResult({
    status: "failed",
    reasonCode: "UNDECLARED_EGRESS",
    decisionType: "redline_violation",
    answer: "",
    actions: []
  });
  const processed = buildProcessed(event, auditResult, {
    status: "Failed",
    auditScore: 0
  });

  const writebackCalls: string[] = [];
  const slashRequests: PostWritebackSlashRequest[] = [];
  const lifecycleEvents: ListenerTaskLifecycleEvent[] = [];

  const result = await runAuditRequestedListenerOnce({
    fromBlock: 123,
    deduper: createInMemoryEventDeduper(),
    getLatestBlockNumber: async () => 123,
    pollAuditRequestedLogs: async () => [event],
    processAuditRequested: async () => processed,
    writeAuditResult: async (p) => {
      writebackCalls.push(p.event.eventKey);
    },
    evaluateSlashDecision,
    handlePostWritebackSlash: async (request) => {
      slashRequests.push(request);
    },
    emitLifecycleEvent: (evt) => {
      lifecycleEvents.push(evt);
    }
  });

  assert.equal(result.processed.length, 1);
  assert.deepEqual(writebackCalls, ["0xabc:0"]);
  assert.equal(slashRequests.length, 1);
  assert.equal(slashRequests[0]!.decision.outcome, "slash");
  assert.equal(slashRequests[0]!.decision.reasonCode, "UNDECLARED_EGRESS");
  assert.equal(slashRequests[0]!.processed.event.eventKey, "0xabc:0");

  const slashedEvent = lifecycleEvents.find(
    (e) => e.type === "listener-task-slashed"
  );
  assert.ok(slashedEvent, "should emit listener-task-slashed lifecycle event");
  assert.equal(
    slashedEvent!.type === "listener-task-slashed" && slashedEvent.slashReasonCode,
    "UNDECLARED_EGRESS"
  );
});

test("E2E scenario 1b: audit fails with ACTION_MISMATCH -> slash is triggered after writeback", async () => {
  const event = buildEvent({ eventKey: "0xdef:1", tokenId: 2n, transactionHash: "0xdef" });
  const auditResult = buildAuditResult({
    status: "failed",
    reasonCode: "ACTION_MISMATCH",
    decisionType: "redline_violation",
    answer: "",
    actions: [],
    actionReconciliation: {
      declaredHosts: ["api.risk.com"],
      observedHosts: ["evil.example"],
      undeclaredObservedHosts: ["evil.example"],
      declaredUnobservedHosts: [],
      reasonCode: "ACTION_MISMATCH"
    }
  });
  const processed = buildProcessed(event, auditResult, {
    status: "Failed",
    auditScore: 0
  });

  const slashRequests: PostWritebackSlashRequest[] = [];

  await runAuditRequestedListenerOnce({
    fromBlock: 123,
    deduper: createInMemoryEventDeduper(),
    getLatestBlockNumber: async () => 123,
    pollAuditRequestedLogs: async () => [event],
    processAuditRequested: async () => processed,
    writeAuditResult: async () => {},
    evaluateSlashDecision,
    handlePostWritebackSlash: async (request) => {
      slashRequests.push(request);
    }
  });

  assert.equal(slashRequests.length, 1);
  assert.equal(slashRequests[0]!.decision.outcome, "slash");
  assert.equal(slashRequests[0]!.decision.reasonCode, "ACTION_MISMATCH");
});

test("E2E scenario 2: audit passes -> no slash is triggered, bond stays intact", async () => {
  const event = buildEvent();
  const auditResult = buildAuditResult({
    status: "completed"
  });
  const processed = buildProcessed(event, auditResult, {
    status: "Passed",
    auditScore: 100
  });

  const writebackCalls: string[] = [];
  const slashRequests: PostWritebackSlashRequest[] = [];
  const lifecycleEvents: ListenerTaskLifecycleEvent[] = [];

  const result = await runAuditRequestedListenerOnce({
    fromBlock: 123,
    deduper: createInMemoryEventDeduper(),
    getLatestBlockNumber: async () => 123,
    pollAuditRequestedLogs: async () => [event],
    processAuditRequested: async () => processed,
    writeAuditResult: async (p) => {
      writebackCalls.push(p.event.eventKey);
    },
    evaluateSlashDecision,
    handlePostWritebackSlash: async (request) => {
      slashRequests.push(request);
    },
    emitLifecycleEvent: (evt) => {
      lifecycleEvents.push(evt);
    }
  });

  assert.equal(result.processed.length, 1);
  assert.deepEqual(writebackCalls, ["0xabc:0"]);
  assert.equal(slashRequests.length, 0, "slash should not be triggered for passing audits");

  const slashedEvent = lifecycleEvents.find(
    (e) => e.type === "listener-task-slashed"
  );
  assert.equal(slashedEvent, undefined, "no slash lifecycle event should be emitted");

  const processedEvent = lifecycleEvents.find(
    (e) => e.type === "listener-task-processed"
  );
  assert.ok(processedEvent, "should emit listener-task-processed event");
  assert.equal(
    processedEvent!.type === "listener-task-processed" && processedEvent.auditStatus,
    "Passed"
  );
});

test("E2E scenario 2b: audit fails with non-slash-eligible reason -> no slash triggered", async () => {
  const event = buildEvent();
  const auditResult = buildAuditResult({
    status: "failed",
    reasonCode: "REQUEST_TIMEOUT",
    decisionType: "ordinary_failure",
    answer: "",
    actions: []
  });
  const processed = buildProcessed(event, auditResult, {
    status: "Failed",
    auditScore: 0
  });

  const slashRequests: PostWritebackSlashRequest[] = [];

  await runAuditRequestedListenerOnce({
    fromBlock: 123,
    deduper: createInMemoryEventDeduper(),
    getLatestBlockNumber: async () => 123,
    pollAuditRequestedLogs: async () => [event],
    processAuditRequested: async () => processed,
    writeAuditResult: async () => {},
    evaluateSlashDecision,
    handlePostWritebackSlash: async (request) => {
      slashRequests.push(request);
    }
  });

  assert.equal(slashRequests.length, 0, "non-slash-eligible failures should not trigger slash");
});

test("E2E scenario 3: slash write fails -> enqueued to retry queue -> retry succeeds", async () => {
  const event = buildEvent();
  const auditResult = buildAuditResult({
    status: "failed",
    reasonCode: "UNDECLARED_EGRESS",
    decisionType: "redline_violation",
    answer: "",
    actions: []
  });
  const processed = buildProcessed(event, auditResult, {
    status: "Failed",
    auditScore: 0
  });

  const lifecycleEvents: ListenerTaskLifecycleEvent[] = [];
  const retryQueue: ListenerSlashRetryItem[] = [];
  const now = new Date("2026-04-01T12:00:00.000Z");

  await runAuditRequestedListenerOnce({
    fromBlock: 123,
    deduper: createInMemoryEventDeduper(),
    getLatestBlockNumber: async () => 123,
    pollAuditRequestedLogs: async () => [event],
    processAuditRequested: async () => processed,
    writeAuditResult: async () => {},
    evaluateSlashDecision,
    handlePostWritebackSlash: async (request) => {
      const slashError = new Error("eth_sendRawTransaction timeout");
      const retryItem = createSlashRetryItem(
        {
          eventKey: request.processed.event.eventKey,
          tokenId: request.processed.writeback.tokenId,
          auditId: 1,
          slashAmount: 1000000000000000000n,
          reasonCode: request.decision.reasonCode!
        },
        slashError,
        now
      );
      retryQueue.push(retryItem);
      throw slashError;
    },
    emitLifecycleEvent: (evt) => {
      lifecycleEvents.push(evt);
    }
  });

  const slashFailedEvent = lifecycleEvents.find(
    (e) => e.type === "listener-task-slash-failed"
  );
  assert.ok(slashFailedEvent, "should emit slash-failed lifecycle event");
  assert.equal(
    slashFailedEvent!.type === "listener-task-slash-failed" && slashFailedEvent.error,
    "Error: eth_sendRawTransaction timeout"
  );

  assert.equal(retryQueue.length, 1);
  assert.equal(retryQueue[0]!.state, "pending");
  assert.equal(retryQueue[0]!.reasonCode, "UNDECLARED_EGRESS");
  assert.equal(retryQueue[0]!.slashAmount, "1000000000000000000");

  const slashBondCalls: WriteSlashBondRequest[] = [];
  const retryNow = new Date("2026-04-01T12:00:10.000Z");

  const retryResults = await flushSlashRetryQueue({
    state: {
      readSlashRetryQueue: async () => [...retryQueue],
      upsertSlashRetry: async () => {
        throw new Error("should not reschedule");
      },
      removeSlashRetry: async (eventKey) => {
        const idx = retryQueue.findIndex((item) => item.eventKey === eventKey);
        if (idx !== -1) {
          retryQueue.splice(idx, 1);
        }
      }
    },
    readAuditReportByIndex: async () => ({
      auditId: 1,
      timestamp: 1774536086,
      auditScore: 0,
      memoryPeakMb: 256,
      cpuAvgMilli: 120,
      requestIpCount: 1,
      status: 2,
      manifestHash: `0x${"a".repeat(64)}`,
      reportHash: `0x${"b".repeat(64)}`,
      reportCID: "",
      manifestUrl: "https://example.com/manifest.json",
      appealRequested: false,
      appealApproved: false
    }),
    submitSlashBond: async (request) => {
      slashBondCalls.push(request);
      return {
        transactionHash: `0x${"f".repeat(64)}` as `0x${string}`,
        blockNumber: 200
      };
    },
    now: () => retryNow
  });

  assert.equal(retryResults.length, 1);
  assert.equal(retryResults[0]!.outcome, "confirmed");
  assert.equal(retryResults[0]!.transactionHash, `0x${"f".repeat(64)}`);
  assert.equal(slashBondCalls.length, 1);
  assert.equal(slashBondCalls[0]!.tokenId, 1n);
  assert.equal(slashBondCalls[0]!.amount, 1000000000000000000n);
  assert.equal(slashBondCalls[0]!.reasonCode, "UNDECLARED_EGRESS");
  assert.equal(retryQueue.length, 0, "retry item should be removed after successful slash");
});

test("E2E scenario 3b: slash write fails twice -> retry queue reschedules with backoff -> eventually succeeds", async () => {
  const now1 = new Date("2026-04-01T12:00:00.000Z");
  const retryItem = createSlashRetryItem(
    {
      eventKey: "0xabc:0",
      tokenId: 1n,
      auditId: 1,
      slashAmount: 500000000000000000n,
      reasonCode: "ACTION_MISMATCH"
    },
    new Error("first failure"),
    now1
  );

  const store: ListenerSlashRetryItem[] = [retryItem];

  const now2 = new Date("2026-04-01T12:00:10.000Z");
  const firstRetryResults = await flushSlashRetryQueue({
    state: {
      readSlashRetryQueue: async () => [...store],
      upsertSlashRetry: async (item) => {
        const idx = store.findIndex((s) => s.eventKey === item.eventKey);
        if (idx !== -1) {
          store[idx] = item;
        } else {
          store.push(item);
        }
      },
      removeSlashRetry: async (eventKey) => {
        const idx = store.findIndex((s) => s.eventKey === eventKey);
        if (idx !== -1) {
          store.splice(idx, 1);
        }
      }
    },
    readAuditReportByIndex: async () => ({
      auditId: 1,
      timestamp: 1774536086,
      auditScore: 0,
      memoryPeakMb: 256,
      cpuAvgMilli: 120,
      requestIpCount: 1,
      status: 2,
      manifestHash: `0x${"a".repeat(64)}`,
      reportHash: `0x${"b".repeat(64)}`,
      reportCID: "",
      manifestUrl: "https://example.com/manifest.json",
      appealRequested: false,
      appealApproved: false
    }),
    submitSlashBond: async () => {
      throw new Error("second failure");
    },
    now: () => now2
  });

  assert.equal(firstRetryResults.length, 1);
  assert.equal(firstRetryResults[0]!.outcome, "retry-scheduled");
  assert.equal(store.length, 1);
  assert.equal(store[0]!.attemptCount, 2);
  assert.equal(store[0]!.lastError, "Error: second failure");

  const now3 = new Date("2026-04-01T12:00:40.000Z");
  const secondRetryResults = await flushSlashRetryQueue({
    state: {
      readSlashRetryQueue: async () => [...store],
      upsertSlashRetry: async () => {
        throw new Error("should not reschedule on success");
      },
      removeSlashRetry: async (eventKey) => {
        const idx = store.findIndex((s) => s.eventKey === eventKey);
        if (idx !== -1) {
          store.splice(idx, 1);
        }
      }
    },
    readAuditReportByIndex: async () => ({
      auditId: 1,
      timestamp: 1774536086,
      auditScore: 0,
      memoryPeakMb: 256,
      cpuAvgMilli: 120,
      requestIpCount: 1,
      status: 2,
      manifestHash: `0x${"a".repeat(64)}`,
      reportHash: `0x${"b".repeat(64)}`,
      reportCID: "",
      manifestUrl: "https://example.com/manifest.json",
      appealRequested: false,
      appealApproved: false
    }),
    submitSlashBond: async () => ({
      transactionHash: `0x${"e".repeat(64)}` as `0x${string}`,
      blockNumber: 300
    }),
    now: () => now3
  });

  assert.equal(secondRetryResults.length, 1);
  assert.equal(secondRetryResults[0]!.outcome, "confirmed");
  assert.equal(store.length, 0);
});

test("E2E scenario 4: slash already applied on-chain -> retry queue reconciles and removes the item", async () => {
  const now1 = new Date("2026-04-01T12:00:00.000Z");
  const retryItem = createSlashRetryItem(
    {
      eventKey: "0xabc:0",
      tokenId: 1n,
      auditId: 1,
      slashAmount: 1000000000000000000n,
      reasonCode: "UNDECLARED_EGRESS"
    },
    new Error("network error"),
    now1
  );

  const store: ListenerSlashRetryItem[] = [retryItem];

  const retryResults = await flushSlashRetryQueue({
    state: {
      readSlashRetryQueue: async () => [...store],
      upsertSlashRetry: async () => {
        throw new Error("should not upsert for a reconciled item");
      },
      removeSlashRetry: async (eventKey) => {
        const idx = store.findIndex((s) => s.eventKey === eventKey);
        if (idx !== -1) {
          store.splice(idx, 1);
        }
      }
    },
    readAuditReportByIndex: async () => ({
      auditId: 1,
      timestamp: 1774536086,
      auditScore: 0,
      memoryPeakMb: 256,
      cpuAvgMilli: 120,
      requestIpCount: 1,
      status: 3,
      manifestHash: `0x${"a".repeat(64)}`,
      reportHash: `0x${"b".repeat(64)}`,
      reportCID: "",
      manifestUrl: "https://example.com/manifest.json",
      appealRequested: false,
      appealApproved: false
    }),
    submitSlashBond: async () => {
      throw new Error("should not submit slash when already slashed");
    },
    now: () => new Date("2026-04-01T12:00:10.000Z")
  });

  assert.equal(retryResults.length, 1);
  assert.equal(retryResults[0]!.outcome, "reconciled");
  assert.equal(store.length, 0, "reconciled item should be removed from queue");
});

test("E2E full flow: multiple events in one batch -> one passes, one fails with slash", async () => {
  const passingEvent = buildEvent({
    eventKey: "0xaaa:0",
    tokenId: 1n,
    transactionHash: "0xaaa"
  });
  const slashEvent = buildEvent({
    eventKey: "0xbbb:1",
    tokenId: 2n,
    transactionHash: "0xbbb"
  });

  const passingResult = buildAuditResult({
    status: "completed"
  });
  const slashResult = buildAuditResult({
    status: "failed",
    reasonCode: "UNDECLARED_EGRESS",
    decisionType: "redline_violation",
    answer: "",
    actions: []
  });

  const passingProcessed = buildProcessed(passingEvent, passingResult, {
    status: "Passed",
    auditScore: 100
  });
  const slashProcessed = buildProcessed(slashEvent, slashResult, {
    status: "Failed",
    auditScore: 0
  });

  const writebackCalls: string[] = [];
  const slashRequests: PostWritebackSlashRequest[] = [];
  const lifecycleTypes: string[] = [];

  await runAuditRequestedListenerOnce({
    fromBlock: 100,
    deduper: createInMemoryEventDeduper(),
    getLatestBlockNumber: async () => 101,
    pollAuditRequestedLogs: async () => [passingEvent, slashEvent],
    processAuditRequested: async (event) => {
      if (event.eventKey === "0xaaa:0") {
        return passingProcessed;
      }
      return slashProcessed;
    },
    writeAuditResult: async (p) => {
      writebackCalls.push(p.event.eventKey);
    },
    evaluateSlashDecision,
    handlePostWritebackSlash: async (request) => {
      slashRequests.push(request);
    },
    emitLifecycleEvent: (evt) => {
      lifecycleTypes.push(`${evt.type}:${evt.eventKey}`);
    }
  });

  assert.deepEqual(writebackCalls, ["0xaaa:0", "0xbbb:1"]);
  assert.equal(slashRequests.length, 1);
  assert.equal(slashRequests[0]!.processed.event.eventKey, "0xbbb:1");
  assert.equal(slashRequests[0]!.decision.reasonCode, "UNDECLARED_EGRESS");

  assert.ok(
    lifecycleTypes.includes("listener-task-processed:0xaaa:0"),
    "passing event should emit processed"
  );
  assert.ok(
    lifecycleTypes.includes("listener-task-slashed:0xbbb:1"),
    "slashed event should emit slashed lifecycle"
  );
  assert.ok(
    !lifecycleTypes.includes("listener-task-slashed:0xaaa:0"),
    "passing event should not emit slashed"
  );
});

test("E2E: slash/compensate decision is not applied when evaluateSlashDecision is not provided", async () => {
  const event = buildEvent();
  const auditResult = buildAuditResult({
    status: "failed",
    reasonCode: "UNDECLARED_EGRESS",
    decisionType: "redline_violation",
    answer: "",
    actions: []
  });
  const processed = buildProcessed(event, auditResult, {
    status: "Failed",
    auditScore: 0
  });

  const slashRequests: PostWritebackSlashRequest[] = [];

  await runAuditRequestedListenerOnce({
    fromBlock: 123,
    deduper: createInMemoryEventDeduper(),
    getLatestBlockNumber: async () => 123,
    pollAuditRequestedLogs: async () => [event],
    processAuditRequested: async () => processed,
    writeAuditResult: async () => {},
    handlePostWritebackSlash: async (request) => {
      slashRequests.push(request);
    }
  });

  assert.equal(
    slashRequests.length,
    0,
    "slash should not be triggered when evaluateSlashDecision is not provided"
  );
});
