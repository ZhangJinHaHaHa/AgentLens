import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createListenerTaskStatusState } from "../../src/listener/listenerTaskStatusState";

async function createStateDir(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const stateDir = await mkdtemp(join(tmpdir(), "listener-task-status-"));
  t.after(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });
  return stateDir;
}

test("createListenerTaskStatusState persists merged task lifecycle and writeback status for one eventKey", async (t) => {
  const timestamps = [
    "2026-03-27T13:00:00.000Z",
    "2026-03-27T13:00:01.000Z",
    "2026-03-27T13:00:02.000Z",
    "2026-03-27T13:00:03.000Z",
    "2026-03-27T13:00:04.000Z"
  ];
  let index = 0;
  const state = createListenerTaskStatusState({
    stateDir: await createStateDir(t),
    now: () => new Date(timestamps[Math.min(index++, timestamps.length - 1)] as string)
  });

  await state.recordEvent({
    type: "listener-task-received",
    eventKey: "0xabc:0",
    tokenId: "1",
    agentName: "risk-agent",
    manifestUrl: "https://example.com/manifest.json",
    blockNumber: 123,
    transactionHash: "0xabc"
  });
  await state.recordEvent({
    type: "listener-task-started",
    eventKey: "0xabc:0",
    tokenId: "1",
    agentName: "risk-agent",
    manifestUrl: "https://example.com/manifest.json",
    blockNumber: 123,
    transactionHash: "0xabc"
  });
  await state.recordEvent({
    type: "listener-task-processed",
    eventKey: "0xabc:0",
    tokenId: "1",
    agentName: "risk-agent",
    manifestUrl: "https://example.com/manifest.json",
    blockNumber: 123,
    transactionHash: "0xabc",
    auditStatus: "Passed",
    auditScore: 100,
    reasonCode: null
  });
  await state.recordEvent({
    type: "writeback-submitting",
    eventKey: "0xabc:0",
    tokenId: "1",
    auditStatus: "Passed",
    auditScore: 100,
    manifestHash: "a".repeat(64),
    reportHash: "b".repeat(64),
    manifestUrl: "https://example.com/manifest.json"
  });
  await state.recordEvent({
    type: "writeback-confirmed",
    eventKey: "0xabc:0",
    tokenId: "1",
    auditStatus: "Passed",
    auditScore: 100,
    manifestHash: "a".repeat(64),
    reportHash: "b".repeat(64),
    manifestUrl: "https://example.com/manifest.json",
    transactionHash: "0xwriteback",
    blockNumber: 130
  });

  assert.deepEqual(await state.readTaskStatuses(), [
    {
      eventKey: "0xabc:0",
      tokenId: "1",
      agentName: "risk-agent",
      manifestUrl: "https://example.com/manifest.json",
      blockNumber: 123,
      transactionHash: "0xabc",
      state: "writeback-confirmed",
      updatedAt: "2026-03-27T13:00:04.000Z",
      reasonCode: null,
      error: null,
      auditStatus: "Passed",
      auditScore: 100,
      history: [
        { state: "listener-task-received", at: "2026-03-27T13:00:00.000Z" },
        { state: "listener-task-started", at: "2026-03-27T13:00:01.000Z" },
        {
          state: "listener-task-processed",
          at: "2026-03-27T13:00:02.000Z",
          auditStatus: "Passed",
          auditScore: 100,
          reasonCode: null
        },
        {
          state: "writeback-submitting",
          at: "2026-03-27T13:00:03.000Z",
          auditStatus: "Passed",
          auditScore: 100
        },
        {
          state: "writeback-confirmed",
          at: "2026-03-27T13:00:04.000Z",
          auditStatus: "Passed",
          auditScore: 100
        }
      ]
    }
  ]);
});

test("createListenerTaskStatusState ignores events without eventKey and keeps bounded history", async (t) => {
  let currentSecond = 0;
  const state = createListenerTaskStatusState({
    stateDir: await createStateDir(t),
    historyLimit: 3,
    now: () => new Date(`2026-03-27T13:01:0${Math.min(currentSecond++, 9)}.000Z`)
  });

  await state.recordEvent({
    type: "listener-service-started",
    pid: 1234
  });

  for (const type of [
    "listener-task-received",
    "listener-task-started",
    "listener-task-processed",
    "writeback-submitting",
    "writeback-failed"
  ]) {
    await state.recordEvent({
      type,
      eventKey: "0xdef:1",
      tokenId: "2",
      agentName: "risk-agent",
      manifestUrl: "https://example.com/manifest.json",
      blockNumber: 124,
      transactionHash: "0xdef",
      auditStatus: "Failed",
      auditScore: 0,
      ...(type === "listener-task-processed"
        ? { reasonCode: "MANIFEST_NAME_MISMATCH" }
        : {}),
      ...(type === "writeback-failed" ? { error: "Error: send failed" } : {})
    });
  }

  assert.deepEqual(await state.readTaskStatuses(), [
    {
      eventKey: "0xdef:1",
      tokenId: "2",
      agentName: "risk-agent",
      manifestUrl: "https://example.com/manifest.json",
      blockNumber: 124,
      transactionHash: "0xdef",
      state: "writeback-failed",
      updatedAt: "2026-03-27T13:01:04.000Z",
      reasonCode: "MANIFEST_NAME_MISMATCH",
      error: "Error: send failed",
      auditStatus: "Failed",
      auditScore: 0,
      history: [
        {
          state: "listener-task-processed",
          at: "2026-03-27T13:01:02.000Z",
          auditStatus: "Failed",
          auditScore: 0,
          reasonCode: "MANIFEST_NAME_MISMATCH"
        },
        {
          state: "writeback-submitting",
          at: "2026-03-27T13:01:03.000Z",
          auditStatus: "Failed",
          auditScore: 0
        },
        {
          state: "writeback-failed",
          at: "2026-03-27T13:01:04.000Z",
          auditStatus: "Failed",
          auditScore: 0,
          error: "Error: send failed"
        }
      ]
    }
  ]);
});
