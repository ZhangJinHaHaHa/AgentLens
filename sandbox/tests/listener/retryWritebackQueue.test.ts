import test from "node:test";
import assert from "node:assert/strict";

import { createRetryQueueItem, flushRetryWritebackQueue } from "../../src/listener/retryWritebackQueue";
import type { ListenerRetryQueueItem, ProcessedAuditRequested } from "../../src/listener/types";

interface LatestAuditReportFixture {
  auditId: number;
  timestamp: number;
  auditScore: number;
  memoryPeakMb: number;
  cpuAvgMilli: number;
  requestIpCount: number;
  status: number;
  manifestHash: `0x${string}`;
  reportHash: `0x${string}`;
  evidenceRoot?: `0x${string}`;
  attestationHash?: `0x${string}`;
  evidenceCID?: string;
  reportCID: string;
  manifestUrl: string;
  appealRequested: boolean;
  appealApproved: boolean;
}

function buildProcessed(): ProcessedAuditRequested {
  return {
    event: {
      eventKey: "0xabc:2",
      tokenId: 2n
    },
    reportPersistence: {
      reportFileName: "persisted-report.json",
      reportFilePath: "/tmp/reports/persisted-report.json"
    },
    writeback: {
      tokenId: 2n,
      auditScore: 100,
      memoryPeakMb: 256,
      cpuAvgMilli: 120,
      requestIpCount: 1,
      status: "Passed",
      manifestHash: "a".repeat(64),
      reportHash: "b".repeat(64),
      reportCID: "",
      manifestUrl: "/tmp/manifest.json"
    }
  } as ProcessedAuditRequested;
}

function buildRetryItem(overrides: Partial<ListenerRetryQueueItem> = {}): ListenerRetryQueueItem {
  return {
    eventKey: "0xabc:2",
    state: "pending",
    tokenId: "2",
    writeback: {
      status: "Passed",
      auditScore: 100,
      memoryPeakMb: 256,
      cpuAvgMilli: 120,
      requestIpCount: 1,
      manifestHash: `0x${"a".repeat(64)}` as `0x${string}`,
      reportHash: `0x${"b".repeat(64)}` as `0x${string}`,
      evidenceRoot: `0x${"0".repeat(64)}` as `0x${string}`,
      attestationHash: `0x${"0".repeat(64)}` as `0x${string}`,
      evidenceCID: "",
      reportCID: "",
      manifestUrl: "/tmp/manifest.json"
    },
    attemptCount: 1,
    lastAttemptAt: "2026-03-27T10:20:30.000Z",
    nextAttemptAt: "2026-03-27T10:20:40.000Z",
    lastError: "send failed",
    ...overrides
  };
}

function buildLatestAuditReport(
  overrides: Partial<LatestAuditReportFixture> = {}
): LatestAuditReportFixture {
  return {
    auditId: 1,
    timestamp: 1774536086,
    auditScore: 100,
    memoryPeakMb: 256,
    cpuAvgMilli: 120,
    requestIpCount: 1,
    status: 1,
    manifestHash: `0x${"a".repeat(64)}` as `0x${string}`,
    reportHash: `0x${"b".repeat(64)}` as `0x${string}`,
    evidenceRoot: `0x${"0".repeat(64)}` as `0x${string}`,
    attestationHash: `0x${"0".repeat(64)}` as `0x${string}`,
    evidenceCID: "",
    reportCID: "",
    manifestUrl: "/tmp/manifest.json",
    appealRequested: false,
    appealApproved: false,
    ...overrides
  };
}

function createQueueState(initialItems: ListenerRetryQueueItem[]): {
  state: {
    readRetryQueue: () => Promise<ListenerRetryQueueItem[]>;
    upsertRetry: (item: ListenerRetryQueueItem) => Promise<void>;
    removeRetry: (eventKey: string) => Promise<void>;
  };
  snapshot: () => ListenerRetryQueueItem[];
} {
  let items = initialItems.map((item) => structuredClone(item));

  return {
    state: {
      readRetryQueue: async () => items.map((item) => structuredClone(item)),
      upsertRetry: async (item) => {
        const index = items.findIndex((existing) => existing.eventKey === item.eventKey);
        if (index === -1) {
          items.push(structuredClone(item));
          return;
        }

        items[index] = structuredClone(item);
      },
      removeRetry: async (eventKey) => {
        items = items.filter((item) => item.eventKey !== eventKey);
      }
    },
    snapshot: () => items.map((item) => structuredClone(item))
  };
}

test("createRetryQueueItem copies only chain-facing writeback fields", () => {
  const item = createRetryQueueItem(buildProcessed(), new Error("send failed"), new Date("2026-03-27T10:20:30.000Z"));
  const expected = buildRetryItem({
    lastError: "Error: send failed"
  });

  assert.equal("reportPersistence" in item.writeback, false);
  assert.equal("reportFilePath" in item.writeback, false);
  assert.deepEqual(item, expected);
});

test("flushRetryWritebackQueue removes a queued item when chain state already matches it", async () => {
  const queue = createQueueState([buildRetryItem()]);
  let submitted = 0;

  const results = await flushRetryWritebackQueue({
    state: queue.state,
    now: () => new Date("2026-03-27T10:21:00.000Z"),
    readLatestAuditReport: async () => buildLatestAuditReport(),
    submitWriteback: async () => {
      submitted += 1;
      return { transactionHash: `0x${"e".repeat(64)}` as `0x${string}`, blockNumber: 333 };
    }
  });

  assert.equal(submitted, 0);
  assert.deepEqual(queue.snapshot(), []);
  assert.deepEqual(results, [
    {
      eventKey: "0xabc:2",
      outcome: "reconciled",
      tokenId: "2"
    }
  ]);
});

test("flushRetryWritebackQueue resubmits a queued item when chain state is still pending", async () => {
  const queue = createQueueState([buildRetryItem()]);
  const submitted: string[] = [];

  const results = await flushRetryWritebackQueue({
    state: queue.state,
    now: () => new Date("2026-03-27T10:21:00.000Z"),
    readLatestAuditReport: async () => buildLatestAuditReport({ status: 0 }),
    submitWriteback: async (item: ListenerRetryQueueItem) => {
      submitted.push(item.eventKey);
      return {
        transactionHash: `0x${"f".repeat(64)}` as `0x${string}`,
        blockNumber: 444
      };
    }
  });

  assert.deepEqual(submitted, ["0xabc:2"]);
  assert.deepEqual(queue.snapshot(), []);
  assert.deepEqual(results, [
    {
      eventKey: "0xabc:2",
      outcome: "confirmed",
      tokenId: "2",
      transactionHash: `0x${"f".repeat(64)}`,
      blockNumber: 444
    }
  ]);
});

test("flushRetryWritebackQueue marks a queued item terminal when on-chain data conflicts", async () => {
  const queue = createQueueState([buildRetryItem()]);
  let submitted = 0;

  const results = await flushRetryWritebackQueue({
    state: queue.state,
    now: () => new Date("2026-03-27T10:21:00.000Z"),
    readLatestAuditReport: async () => buildLatestAuditReport({ status: 2, auditScore: 0 }),
    submitWriteback: async () => {
      submitted += 1;
      return { transactionHash: `0x${"f".repeat(64)}` as `0x${string}`, blockNumber: 444 };
    }
  });

  assert.equal(submitted, 0);
  assert.deepEqual(queue.snapshot(), [
    {
      ...buildRetryItem(),
      state: "terminal",
      lastAttemptAt: "2026-03-27T10:21:00.000Z",
      lastError: "latest on-chain audit record conflicts with queued writeback"
    }
  ]);
  assert.deepEqual(results, [
    {
      eventKey: "0xabc:2",
      outcome: "conflict",
      tokenId: "2",
      state: "terminal",
      error: "latest on-chain audit record conflicts with queued writeback"
    }
  ]);
});

test("flushRetryWritebackQueue updates attempt count and backoff when retry submission fails", async () => {
  const queue = createQueueState([buildRetryItem()]);

  const results = await flushRetryWritebackQueue({
    state: queue.state,
    now: () => new Date("2026-03-27T10:21:00.000Z"),
    readLatestAuditReport: async () => buildLatestAuditReport({ status: 0 }),
    submitWriteback: async () => {
      throw new Error("eth_sendRawTransaction failed");
    }
  });

  assert.deepEqual(queue.snapshot(), [
    {
      ...buildRetryItem(),
      attemptCount: 2,
      lastAttemptAt: "2026-03-27T10:21:00.000Z",
      nextAttemptAt: "2026-03-27T10:21:30.000Z",
      lastError: "Error: eth_sendRawTransaction failed"
    }
  ]);
  assert.deepEqual(results, [
    {
      eventKey: "0xabc:2",
      outcome: "retry-scheduled",
      tokenId: "2",
      attemptCount: 2,
      nextAttemptAt: "2026-03-27T10:21:30.000Z",
      error: "Error: eth_sendRawTransaction failed"
    }
  ]);
});
