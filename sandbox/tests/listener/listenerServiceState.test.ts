import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createListenerServiceState } from "../../src/listener/listenerServiceState";

test("createListenerServiceState acquires lock, writes runtime status, and releases lock", async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "listener-service-state-"));

  try {
    const serviceState = createListenerServiceState({ stateDir });

    await serviceState.acquireLock({
      pid: 4321,
      startedAt: "2026-03-27T12:00:00.000Z"
    });

    await serviceState.writeStatus({
      pid: 4321,
      state: "running",
      startedAt: "2026-03-27T12:00:00.000Z",
      updatedAt: "2026-03-27T12:00:05.000Z",
      nextBlock: 201,
      lastPollAt: "2026-03-27T12:00:05.000Z"
    });

    const lockContents = JSON.parse(
      await readFile(join(stateDir, "service-lock.json"), "utf8")
    ) as Record<string, unknown>;
    const statusContents = JSON.parse(
      await readFile(join(stateDir, "runtime-status.json"), "utf8")
    ) as Record<string, unknown>;

    assert.equal(lockContents.pid, 4321);
    assert.equal(lockContents.startedAt, "2026-03-27T12:00:00.000Z");
    assert.equal(statusContents.state, "running");
    assert.equal(statusContents.nextBlock, 201);

    await serviceState.releaseLock();

    await assert.rejects(
      readFile(join(stateDir, "service-lock.json"), "utf8"),
      /ENOENT/
    );
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("createListenerServiceState rejects a second lock owner for the same stateDir", async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "listener-service-state-"));

  try {
    const first = createListenerServiceState({ stateDir });
    const second = createListenerServiceState({ stateDir });

    await first.acquireLock({
      pid: 1001,
      startedAt: "2026-03-27T12:00:00.000Z"
    });

    await assert.rejects(
      second.acquireLock({
        pid: 1002,
        startedAt: "2026-03-27T12:01:00.000Z"
      }),
      /already locked/i
    );

    await first.releaseLock();
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});
