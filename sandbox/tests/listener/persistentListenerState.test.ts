import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createPersistentListenerState } from "../../src/listener/persistentListenerState";

async function createStateDir(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const stateDir = await mkdtemp(join(tmpdir(), "listener-state-"));
  t.after(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });
  return stateDir;
}

test("createPersistentListenerState returns undefined when cursor has not been saved", async (t) => {
  const state = createPersistentListenerState({
    stateDir: await createStateDir(t)
  });

  assert.equal(await state.readCursor(), undefined);
});

test("createPersistentListenerState persists and reloads the next block cursor", async (t) => {
  const state = createPersistentListenerState({
    stateDir: await createStateDir(t)
  });

  await state.writeCursor(3253);

  assert.equal(await state.readCursor(), 3253);
});

test("createPersistentListenerState dedupes queued writeback retries by eventKey", async (t) => {
  const state = createPersistentListenerState({
    stateDir: await createStateDir(t)
  });
  const retryItem = {
    eventKey: "0xabc:2",
    state: "pending" as const,
    tokenId: "2",
    writeback: {
      status: "Passed" as const,
      auditScore: 100,
      memoryPeakMb: 256,
      cpuAvgMilli: 120,
      requestIpCount: 1,
      manifestHash: `0x${"a".repeat(64)}` as `0x${string}`,
      reportHash: `0x${"b".repeat(64)}` as `0x${string}`,
      reportCID: "",
      manifestUrl: "/tmp/manifest.json"
    },
    attemptCount: 1,
    lastAttemptAt: "2026-03-27T10:20:30.000Z",
    nextAttemptAt: "2026-03-27T10:20:40.000Z",
    lastError: "sendRawTransaction timeout"
  };

  await state.enqueueRetry(retryItem);
  await state.enqueueRetry({
    ...retryItem,
    lastError: "different error should not create a duplicate item"
  });

  assert.deepEqual(await state.readRetryQueue(), [retryItem]);
});

test("createPersistentListenerState persists retry item mutation and removal", async (t) => {
  const state = createPersistentListenerState({
    stateDir: await createStateDir(t)
  });

  await state.enqueueRetry({
    eventKey: "0xdef:3",
    state: "pending",
    tokenId: "3",
    writeback: {
      status: "Failed",
      auditScore: 0,
      memoryPeakMb: 0,
      cpuAvgMilli: 0,
      requestIpCount: 0,
      manifestHash: `0x${"c".repeat(64)}` as `0x${string}`,
      reportHash: `0x${"d".repeat(64)}` as `0x${string}`,
      reportCID: "",
      manifestUrl: "/tmp/manifest.json"
    },
    attemptCount: 1,
    lastAttemptAt: "2026-03-27T10:20:30.000Z",
    nextAttemptAt: "2026-03-27T10:20:40.000Z",
    lastError: "estimateGas failed"
  });

  await state.upsertRetry({
    eventKey: "0xdef:3",
    state: "pending",
    tokenId: "3",
    writeback: {
      status: "Failed",
      auditScore: 0,
      memoryPeakMb: 0,
      cpuAvgMilli: 0,
      requestIpCount: 0,
      manifestHash: `0x${"c".repeat(64)}` as `0x${string}`,
      reportHash: `0x${"d".repeat(64)}` as `0x${string}`,
      reportCID: "",
      manifestUrl: "/tmp/manifest.json"
    },
    attemptCount: 2,
    lastAttemptAt: "2026-03-27T10:21:30.000Z",
    nextAttemptAt: "2026-03-27T10:22:00.000Z",
    lastError: "eth_call failed"
  });

  assert.deepEqual(await state.readRetryQueue(), [
    {
      eventKey: "0xdef:3",
      state: "pending",
      tokenId: "3",
      writeback: {
        status: "Failed",
        auditScore: 0,
        memoryPeakMb: 0,
        cpuAvgMilli: 0,
        requestIpCount: 0,
        manifestHash: `0x${"c".repeat(64)}` as `0x${string}`,
        reportHash: `0x${"d".repeat(64)}` as `0x${string}`,
        reportCID: "",
        manifestUrl: "/tmp/manifest.json"
      },
      attemptCount: 2,
      lastAttemptAt: "2026-03-27T10:21:30.000Z",
      nextAttemptAt: "2026-03-27T10:22:00.000Z",
      lastError: "eth_call failed"
    }
  ]);

  await state.removeRetry("0xdef:3");

  assert.deepEqual(await state.readRetryQueue(), []);
});

test("createPersistentListenerState persists audit execution retry items by eventKey", async (t) => {
  const state = createPersistentListenerState({
    stateDir: await createStateDir(t)
  });

  await state.enqueueAuditExecutionRetry({
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
  await state.enqueueAuditExecutionRetry({
    eventKey: "0xabc:0",
    tokenId: "1",
    developer: "0x000000000000000000000000000000000000dEaD",
    agentName: "risk-agent",
    manifestUrl: "https://example.com/manifest.json",
    blockNumber: 123,
    transactionHash: "0xabc",
    attemptCount: 2,
    lastAttemptAt: "2026-03-28T10:00:10.000Z",
    nextAttemptAt: "2026-03-28T10:00:40.000Z",
    lastReasonCode: "AGENT_UNAVAILABLE",
    lastError: "retryable audit execution failure: AGENT_UNAVAILABLE"
  });

  assert.deepEqual(await state.readAuditExecutionRetryQueue(), [
    {
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
    }
  ]);
});

test("createPersistentListenerState updates and removes audit execution retry items", async (t) => {
  const state = createPersistentListenerState({
    stateDir: await createStateDir(t)
  });

  await state.enqueueAuditExecutionRetry({
    eventKey: "0xdef:1",
    tokenId: "2",
    developer: "0x000000000000000000000000000000000000dEaD",
    agentName: "risk-agent",
    manifestUrl: "https://example.com/manifest.json",
    blockNumber: 124,
    transactionHash: "0xdef",
    attemptCount: 1,
    lastAttemptAt: "2026-03-28T10:00:00.000Z",
    nextAttemptAt: "2026-03-28T10:00:10.000Z",
    lastReasonCode: "REQUEST_TIMEOUT",
    lastError: "retryable audit execution failure: REQUEST_TIMEOUT"
  });

  await state.upsertAuditExecutionRetry({
    eventKey: "0xdef:1",
    tokenId: "2",
    developer: "0x000000000000000000000000000000000000dEaD",
    agentName: "risk-agent",
    manifestUrl: "https://example.com/manifest.json",
    blockNumber: 124,
    transactionHash: "0xdef",
    attemptCount: 2,
    lastAttemptAt: "2026-03-28T10:00:10.000Z",
    nextAttemptAt: "2026-03-28T10:00:40.000Z",
    lastReasonCode: "AGENT_UNAVAILABLE",
    lastError: "retryable audit execution failure: AGENT_UNAVAILABLE"
  });

  assert.deepEqual(await state.readAuditExecutionRetryQueue(), [
    {
      eventKey: "0xdef:1",
      tokenId: "2",
      developer: "0x000000000000000000000000000000000000dEaD",
      agentName: "risk-agent",
      manifestUrl: "https://example.com/manifest.json",
      blockNumber: 124,
      transactionHash: "0xdef",
      attemptCount: 2,
      lastAttemptAt: "2026-03-28T10:00:10.000Z",
      nextAttemptAt: "2026-03-28T10:00:40.000Z",
      lastReasonCode: "AGENT_UNAVAILABLE",
      lastError: "retryable audit execution failure: AGENT_UNAVAILABLE"
    }
  ]);

  await state.removeAuditExecutionRetry("0xdef:1");

  assert.deepEqual(await state.readAuditExecutionRetryQueue(), []);
});

test("createPersistentListenerState persists slash retry items by eventKey", async (t) => {
  const state = createPersistentListenerState({
    stateDir: await createStateDir(t)
  });

  await state.enqueueSlashRetry({
    eventKey: "0xabc:0",
    state: "pending",
    tokenId: "1",
    auditId: 3,
    slashAmount: "1000000000000000000",
    reasonCode: "ACTION_MISMATCH",
    attemptCount: 1,
    lastAttemptAt: "2026-03-30T09:00:00.000Z",
    nextAttemptAt: "2026-03-30T09:00:10.000Z",
    lastError: "slashBond timeout"
  });
  await state.enqueueSlashRetry({
    eventKey: "0xabc:0",
    state: "pending",
    tokenId: "1",
    auditId: 3,
    slashAmount: "1000000000000000000",
    reasonCode: "ACTION_MISMATCH",
    attemptCount: 2,
    lastAttemptAt: "2026-03-30T09:00:10.000Z",
    nextAttemptAt: "2026-03-30T09:00:40.000Z",
    lastError: "later error should not create a duplicate item"
  });

  assert.deepEqual(await state.readSlashRetryQueue(), [
    {
      eventKey: "0xabc:0",
      state: "pending",
      tokenId: "1",
      auditId: 3,
      slashAmount: "1000000000000000000",
      reasonCode: "ACTION_MISMATCH",
      attemptCount: 1,
      lastAttemptAt: "2026-03-30T09:00:00.000Z",
      nextAttemptAt: "2026-03-30T09:00:10.000Z",
      lastError: "slashBond timeout"
    }
  ]);
});

test("createPersistentListenerState updates and removes slash retry items", async (t) => {
  const state = createPersistentListenerState({
    stateDir: await createStateDir(t)
  });

  await state.enqueueSlashRetry({
    eventKey: "0xdef:1",
    state: "pending",
    tokenId: "2",
    auditId: 4,
    slashAmount: "500000000000000000",
    reasonCode: "UNDECLARED_EGRESS",
    attemptCount: 1,
    lastAttemptAt: "2026-03-30T09:10:00.000Z",
    nextAttemptAt: "2026-03-30T09:10:10.000Z",
    lastError: "first slash failure"
  });

  await state.upsertSlashRetry({
    eventKey: "0xdef:1",
    state: "pending",
    tokenId: "2",
    auditId: 4,
    slashAmount: "500000000000000000",
    reasonCode: "UNDECLARED_EGRESS",
    attemptCount: 2,
    lastAttemptAt: "2026-03-30T09:10:10.000Z",
    nextAttemptAt: "2026-03-30T09:10:40.000Z",
    lastError: "second slash failure"
  });

  assert.deepEqual(await state.readSlashRetryQueue(), [
    {
      eventKey: "0xdef:1",
      state: "pending",
      tokenId: "2",
      auditId: 4,
      slashAmount: "500000000000000000",
      reasonCode: "UNDECLARED_EGRESS",
      attemptCount: 2,
      lastAttemptAt: "2026-03-30T09:10:10.000Z",
      nextAttemptAt: "2026-03-30T09:10:40.000Z",
      lastError: "second slash failure"
    }
  ]);

  await state.removeSlashRetry("0xdef:1");

  assert.deepEqual(await state.readSlashRetryQueue(), []);
});
