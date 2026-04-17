import test from "node:test";
import assert from "node:assert/strict";

import {
  createSlashRetryItem,
  flushSlashRetryQueue
} from "../../src/listener/retrySlashQueue";
import type { ListenerSlashRetryItem } from "../../src/listener/types";
import type { WriteSlashBondRequest } from "../../src/listener/writeSlashBond";

test("createSlashRetryItem captures durable slash state and schedules the first retry", () => {
  const item = createSlashRetryItem(
    {
      eventKey: "0xabc:0",
      tokenId: 1n,
      auditId: 3,
      slashAmount: 1000000000000000000n,
      reasonCode: "ACTION_MISMATCH"
    },
    new Error("slashBond timeout"),
    new Date("2026-03-30T09:00:00.000Z")
  );

  assert.deepEqual(item, {
    eventKey: "0xabc:0",
    state: "pending",
    tokenId: "1",
    auditId: 3,
    slashAmount: "1000000000000000000",
    reasonCode: "ACTION_MISMATCH",
    attemptCount: 1,
    lastAttemptAt: "2026-03-30T09:00:00.000Z",
    nextAttemptAt: "2026-03-30T09:00:10.000Z",
    lastError: "Error: slashBond timeout"
  });
});

test("flushSlashRetryQueue removes queued items once the targeted audit is already slashed", async () => {
  const readCalls: Array<{ tokenId: bigint; index: number }> = [];
  const removed: string[] = [];
  const item: ListenerSlashRetryItem = {
    eventKey: "0xabc:0",
    state: "pending",
    tokenId: "1",
    auditId: 3,
    slashAmount: "1000000000000000000",
    reasonCode: "ACTION_MISMATCH",
    attemptCount: 1,
    lastAttemptAt: "2026-03-30T09:00:00.000Z",
    nextAttemptAt: "2026-03-30T09:00:10.000Z",
    lastError: "Error: slashBond timeout"
  };

  const results = await flushSlashRetryQueue({
    state: {
      readSlashRetryQueue: async () => [item],
      upsertSlashRetry: async () => {
        throw new Error("should not upsert an already-slashed item");
      },
      removeSlashRetry: async (eventKey: string) => {
        removed.push(eventKey);
      }
    },
    readAuditReportByIndex: async (tokenId: bigint, index: number) => {
      readCalls.push({ tokenId, index });
      return {
        auditId: 3,
        timestamp: 1774536086,
        auditScore: 0,
        memoryPeakMb: 256,
        cpuAvgMilli: 120,
        requestIpCount: 1,
        status: 3,
        manifestHash: `0x${"a".repeat(64)}`,
        reportHash: `0x${"b".repeat(64)}`,
        reportCID: "bafybeigdyrzt",
        manifestUrl: "https://example.com/manifest.json",
        appealRequested: false,
        appealApproved: false
      };
    },
    submitSlashBond: async () => {
      throw new Error("should not submit slashBond when already slashed");
    },
    now: () => new Date("2026-03-30T09:00:10.000Z")
  });

  assert.deepEqual(readCalls, [{ tokenId: 1n, index: 2 }]);
  assert.deepEqual(removed, ["0xabc:0"]);
  assert.deepEqual(results, [
    {
      eventKey: "0xabc:0",
      outcome: "reconciled",
      tokenId: "1",
      auditId: 3
    }
  ]);
});

test("flushSlashRetryQueue submits slashBond when the targeted audit is not yet slashed", async () => {
  const removed: string[] = [];
  const slashCalls: Array<{
    tokenId: bigint;
    auditId: number;
    amount: bigint;
    reasonCode: string;
  }> = [];
  const item: ListenerSlashRetryItem = {
    eventKey: "0xdef:1",
    state: "pending",
    tokenId: "2",
    auditId: 4,
    slashAmount: "500000000000000000",
    reasonCode: "UNDECLARED_EGRESS",
    attemptCount: 1,
    lastAttemptAt: "2026-03-30T09:10:00.000Z",
    nextAttemptAt: "2026-03-30T09:10:10.000Z",
    lastError: "Error: first slash failure"
  };

  const results = await flushSlashRetryQueue({
    state: {
      readSlashRetryQueue: async () => [item],
      upsertSlashRetry: async () => {
        throw new Error("should not reschedule a confirmed slash");
      },
      removeSlashRetry: async (eventKey: string) => {
        removed.push(eventKey);
      }
    },
    readAuditReportByIndex: async () => ({
      auditId: 4,
      timestamp: 1774536086,
      auditScore: 0,
      memoryPeakMb: 256,
      cpuAvgMilli: 120,
      requestIpCount: 1,
      status: 2,
      manifestHash: `0x${"a".repeat(64)}`,
      reportHash: `0x${"b".repeat(64)}`,
      reportCID: "bafybeigdyrzt",
      manifestUrl: "https://example.com/manifest.json",
      appealRequested: false,
      appealApproved: false
    }),
    submitSlashBond: async (request: WriteSlashBondRequest) => {
      slashCalls.push(request);
      return {
        transactionHash: `0x${"f".repeat(64)}` as `0x${string}`,
        blockNumber: 77
      };
    },
    now: () => new Date("2026-03-30T09:10:10.000Z")
  });

  assert.deepEqual(slashCalls, [
    {
      tokenId: 2n,
      auditId: 4,
      amount: 500000000000000000n,
      reasonCode: "UNDECLARED_EGRESS"
    }
  ]);
  assert.deepEqual(removed, ["0xdef:1"]);
  assert.deepEqual(results, [
    {
      eventKey: "0xdef:1",
      outcome: "confirmed",
      tokenId: "2",
      auditId: 4,
      transactionHash: `0x${"f".repeat(64)}` as `0x${string}`,
      blockNumber: 77
    }
  ]);
});

test("flushSlashRetryQueue reschedules slash submission failures with backoff", async () => {
  const updates: ListenerSlashRetryItem[] = [];
  const item: ListenerSlashRetryItem = {
    eventKey: "0xaaa:2",
    state: "pending",
    tokenId: "3",
    auditId: 2,
    slashAmount: "250000000000000000",
    reasonCode: "ACTION_MISMATCH",
    attemptCount: 1,
    lastAttemptAt: "2026-03-30T09:20:00.000Z",
    nextAttemptAt: "2026-03-30T09:20:10.000Z",
    lastError: "Error: first slash failure"
  };

  const results = await flushSlashRetryQueue({
    state: {
      readSlashRetryQueue: async () => [item],
      upsertSlashRetry: async (next: ListenerSlashRetryItem) => {
        updates.push(next);
      },
      removeSlashRetry: async () => {
        throw new Error("should not remove a rescheduled slash");
      }
    },
    readAuditReportByIndex: async () => ({
      auditId: 2,
      timestamp: 1774536086,
      auditScore: 0,
      memoryPeakMb: 256,
      cpuAvgMilli: 120,
      requestIpCount: 1,
      status: 2,
      manifestHash: `0x${"a".repeat(64)}`,
      reportHash: `0x${"b".repeat(64)}`,
      reportCID: "bafybeigdyrzt",
      manifestUrl: "https://example.com/manifest.json",
      appealRequested: false,
      appealApproved: false
    }),
    submitSlashBond: async () => {
      throw new Error("eth_sendRawTransaction timeout");
    },
    now: () => new Date("2026-03-30T09:20:10.000Z")
  });

  assert.deepEqual(updates, [
    {
      ...item,
      attemptCount: 2,
      lastAttemptAt: "2026-03-30T09:20:10.000Z",
      nextAttemptAt: "2026-03-30T09:20:40.000Z",
      lastError: "Error: eth_sendRawTransaction timeout"
    }
  ]);
  assert.deepEqual(results, [
    {
      eventKey: "0xaaa:2",
      outcome: "retry-scheduled",
      tokenId: "3",
      auditId: 2,
      attemptCount: 2,
      nextAttemptAt: "2026-03-30T09:20:40.000Z",
      error: "Error: eth_sendRawTransaction timeout"
    }
  ]);
});
