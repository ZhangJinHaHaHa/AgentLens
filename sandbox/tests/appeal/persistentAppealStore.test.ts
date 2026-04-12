import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  createPersistentAppealStore,
  resolveAppealStateDirFromEnv
} from "../../src/appeal/persistentAppealStore";

test("createPersistentAppealStore persists a new appeal ticket with evidence fields", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}appeal-store-`);
  const store = createPersistentAppealStore({
    stateDir,
    now: () => new Date("2026-03-30T10:15:00.000Z"),
    createAppealId: () => "apl-001"
  });

  try {
    const created = await store.createAppeal({
      tokenId: "1",
      auditId: "2",
      auditIndex: 0,
      reason: "The slash was caused by a declared integration.",
      reportCID: "bafy-report",
      reportHash: "0x1234",
      manifestUrl: "https://example.com/manifest.json"
    });

    assert.deepEqual(created, {
      appealId: "apl-001",
      tokenId: "1",
      auditId: "2",
      auditIndex: 0,
      reason: "The slash was caused by a declared integration.",
      reportCID: "bafy-report",
      reportHash: "0x1234",
      manifestUrl: "https://example.com/manifest.json",
      status: "reviewing",
      createdAt: "2026-03-30T10:15:00.000Z"
    });

    assert.deepEqual(await store.readAppeals(), [created]);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("createPersistentAppealStore returns the latest appeal for the same tokenId and auditId", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}appeal-store-`);
  let callCount = 0;
  const store = createPersistentAppealStore({
    stateDir,
    now: () => new Date(`2026-03-30T10:15:0${callCount}.000Z`),
    createAppealId: () => {
      callCount += 1;
      return `apl-00${callCount}`;
    }
  });

  try {
    await store.createAppeal({
      tokenId: "1",
      auditId: "2",
      auditIndex: 0,
      reason: "first"
    });
    const latest = await store.createAppeal({
      tokenId: "1",
      auditId: "2",
      auditIndex: 0,
      reason: "second"
    });

    assert.deepEqual(await store.findLatestAppeal("1", "2"), latest);
    assert.equal(await store.findLatestAppeal("1", "3"), undefined);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("createPersistentAppealStore updates an appeal after manual review", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}appeal-store-`);
  const store = createPersistentAppealStore({
    stateDir,
    now: () => new Date("2026-03-30T10:30:00.000Z"),
    createAppealId: () => "apl-001"
  });

  try {
    await store.createAppeal({
      tokenId: "1",
      auditId: "2",
      auditIndex: 0,
      reason: "Need manual review."
    });

    const updated = await store.reviewAppeal("apl-001", {
      status: "approved",
      reviewer: "operator-1",
      reviewResult: "False positive confirmed after operator review.",
      compensationTxHash: "0xabc123"
    });

    assert.deepEqual(updated, {
      appealId: "apl-001",
      tokenId: "1",
      auditId: "2",
      auditIndex: 0,
      reason: "Need manual review.",
      status: "approved",
      createdAt: "2026-03-30T10:30:00.000Z",
      reviewedAt: "2026-03-30T10:30:00.000Z",
      reviewer: "operator-1",
      reviewResult: "False positive confirmed after operator review.",
      compensationTxHash: "0xabc123"
    });
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("resolveAppealStateDirFromEnv defaults under .runtime/appeals", () => {
  assert.equal(
    resolveAppealStateDirFromEnv({}, "/tmp/project"),
    join("/tmp/project", ".runtime", "appeals")
  );
});

test("resolveAppealStateDirFromEnv honors AUDIT_APPEAL_STATE_DIR", () => {
  assert.equal(
    resolveAppealStateDirFromEnv({ AUDIT_APPEAL_STATE_DIR: "/tmp/custom-appeals" }, "/tmp/project"),
    "/tmp/custom-appeals"
  );
});
