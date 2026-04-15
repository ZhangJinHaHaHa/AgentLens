import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { createAppealReviewStore } from "../../src/appeal/appealReviewStore";
import type { AppealReviewCreateInput } from "../../src/appeal/appealReviewTypes";

const sampleInput: AppealReviewCreateInput = {
  appealId: "apl-001",
  eventKey: "evt-001",
  tokenId: "42",
  reason: "The slash was a false positive.",
  slashReasonCode: 1,
  originalAuditScore: 35
};

test("createAppealReviewStore saves a new review record with pending status", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}review-store-`);

  try {
    const store = createAppealReviewStore({
      stateDir,
      now: () => new Date("2026-04-10T10:00:00.000Z")
    });

    const record = await store.create(sampleInput);

    assert.equal(record.appealId, "apl-001");
    assert.equal(record.eventKey, "evt-001");
    assert.equal(record.tokenId, "42");
    assert.equal(record.status, "pending");
    assert.equal(record.reason, "The slash was a false positive.");
    assert.equal(record.slashReasonCode, 1);
    assert.equal(record.originalAuditScore, 35);
    assert.equal(record.createdAt, "2026-04-10T10:00:00.000Z");
    assert.equal(record.reviewerAddress, undefined);
    assert.equal(record.reviewNote, undefined);
    assert.equal(record.reviewedAt, undefined);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("createAppealReviewStore reads back a saved record by appealId", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}review-store-`);

  try {
    const store = createAppealReviewStore({
      stateDir,
      now: () => new Date("2026-04-10T10:00:00.000Z")
    });

    await store.create(sampleInput);
    const found = await store.findById("apl-001");

    assert.notEqual(found, undefined);
    assert.equal(found!.appealId, "apl-001");
    assert.equal(found!.status, "pending");
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("createAppealReviewStore returns undefined for unknown appealId", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}review-store-`);

  try {
    const store = createAppealReviewStore({
      stateDir,
      now: () => new Date("2026-04-10T10:00:00.000Z")
    });

    const found = await store.findById("apl-nonexistent");

    assert.equal(found, undefined);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("createAppealReviewStore updates a record immutably", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}review-store-`);

  try {
    const store = createAppealReviewStore({
      stateDir,
      now: () => new Date("2026-04-10T11:00:00.000Z")
    });

    await store.create({
      ...sampleInput,
      appealId: "apl-002"
    });

    const updated = await store.update("apl-002", {
      status: "under_review",
      reviewerAddress: "0xreviewer1"
    });

    assert.equal(updated.status, "under_review");
    assert.equal(updated.reviewerAddress, "0xreviewer1");
    assert.equal(updated.appealId, "apl-002");

    // Verify persistence
    const reread = await store.findById("apl-002");
    assert.equal(reread!.status, "under_review");
    assert.equal(reread!.reviewerAddress, "0xreviewer1");
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("createAppealReviewStore throws when updating a non-existent record", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}review-store-`);

  try {
    const store = createAppealReviewStore({
      stateDir,
      now: () => new Date("2026-04-10T10:00:00.000Z")
    });

    await assert.rejects(
      () => store.update("apl-ghost", { status: "under_review" }),
      /Appeal review record not found: apl-ghost/
    );
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("createAppealReviewStore lists all records", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}review-store-`);

  try {
    const store = createAppealReviewStore({
      stateDir,
      now: () => new Date("2026-04-10T10:00:00.000Z")
    });

    await store.create({ ...sampleInput, appealId: "apl-001" });
    await store.create({ ...sampleInput, appealId: "apl-002" });
    await store.create({ ...sampleInput, appealId: "apl-003" });

    const all = await store.listAll();

    assert.equal(all.length, 3);
    const ids = all.map((record) => record.appealId);
    assert.deepEqual(ids.sort(), ["apl-001", "apl-002", "apl-003"]);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("createAppealReviewStore filters records by status", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}review-store-`);

  try {
    const store = createAppealReviewStore({
      stateDir,
      now: () => new Date("2026-04-10T10:00:00.000Z")
    });

    await store.create({ ...sampleInput, appealId: "apl-001" });
    await store.create({ ...sampleInput, appealId: "apl-002" });
    await store.update("apl-002", {
      status: "under_review",
      reviewerAddress: "0xreviewer1"
    });

    const pendingRecords = await store.listByStatus("pending");
    const underReviewRecords = await store.listByStatus("under_review");

    assert.equal(pendingRecords.length, 1);
    assert.equal(pendingRecords[0].appealId, "apl-001");
    assert.equal(underReviewRecords.length, 1);
    assert.equal(underReviewRecords[0].appealId, "apl-002");
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("createAppealReviewStore persists data to individual JSON files", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}review-store-`);

  try {
    const store = createAppealReviewStore({
      stateDir,
      now: () => new Date("2026-04-10T10:00:00.000Z")
    });

    await store.create(sampleInput);

    const filePath = join(stateDir, "appeal-reviews", "apl-001.json");
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    assert.equal(parsed.appealId, "apl-001");
    assert.equal(parsed.status, "pending");
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("createAppealReviewStore rejects duplicate appealId", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}review-store-`);

  try {
    const store = createAppealReviewStore({
      stateDir,
      now: () => new Date("2026-04-10T10:00:00.000Z")
    });

    await store.create(sampleInput);

    await assert.rejects(
      () => store.create(sampleInput),
      /Appeal review record already exists: apl-001/
    );
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});
