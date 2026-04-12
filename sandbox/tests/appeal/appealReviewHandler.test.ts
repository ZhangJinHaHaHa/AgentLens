import assert from "node:assert/strict";
import test from "node:test";

import {
  createAppealReviewHandler,
  type AppealReviewHandlerDependencies
} from "../../src/appeal/appealReviewHandler";
import type {
  AppealReviewRecord,
  AppealReviewStatus
} from "../../src/appeal/appealReviewTypes";
import type { AppealCompensationRequest } from "../../src/appeal/appealCompensation";

function createInMemoryStore(): AppealReviewHandlerDependencies["store"] & {
  records: Map<string, AppealReviewRecord>;
} {
  const records = new Map<string, AppealReviewRecord>();

  return {
    records,
    async findById(appealId: string) {
      return records.get(appealId);
    },
    async update(appealId: string, fields: Partial<AppealReviewRecord>) {
      const existing = records.get(appealId);
      if (!existing) {
        throw new Error(`Appeal review record not found: ${appealId}`);
      }

      const updated: AppealReviewRecord = { ...existing, ...fields };
      records.set(appealId, updated);
      return updated;
    }
  };
}

function seedRecord(
  store: ReturnType<typeof createInMemoryStore>,
  overrides: Partial<AppealReviewRecord> = {}
): AppealReviewRecord {
  const record: AppealReviewRecord = {
    appealId: "apl-001",
    eventKey: "evt-001",
    tokenId: "42",
    status: "pending",
    reason: "False positive.",
    createdAt: "2026-04-10T10:00:00.000Z",
    slashReasonCode: 1,
    originalAuditScore: 35,
    ...overrides
  };
  store.records.set(record.appealId, record);
  return record;
}

test("startReview transitions pending -> under_review", async () => {
  const store = createInMemoryStore();
  seedRecord(store);
  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T11:00:00.000Z")
  });

  const result = await handler.startReview("apl-001", "0xreviewer1");

  assert.equal(result.status, "under_review");
  assert.equal(result.reviewerAddress, "0xreviewer1");
  assert.equal(result.appealId, "apl-001");
});

test("startReview throws if appeal not found", async () => {
  const store = createInMemoryStore();
  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T11:00:00.000Z")
  });

  await assert.rejects(
    () => handler.startReview("apl-ghost", "0xreviewer1"),
    /Appeal not found: apl-ghost/
  );
});

test("startReview throws if appeal is not pending", async () => {
  const store = createInMemoryStore();
  seedRecord(store, { status: "under_review" });
  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T11:00:00.000Z")
  });

  await assert.rejects(
    () => handler.startReview("apl-001", "0xreviewer1"),
    /Invalid status transition: cannot move from "under_review" to "under_review"/
  );
});

test("startReview throws if appeal is already approved", async () => {
  const store = createInMemoryStore();
  seedRecord(store, { status: "approved" });
  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T11:00:00.000Z")
  });

  await assert.rejects(
    () => handler.startReview("apl-001", "0xreviewer1"),
    /Invalid status transition: cannot move from "approved" to "under_review"/
  );
});

test("approveAppeal transitions under_review -> approved and triggers compensateBond", async () => {
  const store = createInMemoryStore();
  seedRecord(store, { status: "under_review", reviewerAddress: "0xreviewer1" });

  const compensationCalls: AppealCompensationRequest[] = [];

  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T12:00:00.000Z"),
    compensateAppeal: async (request) => {
      compensationCalls.push(request);
      return { transactionHash: "0xcompensated" as `0x${string}` };
    },
    compensationAmount: "500000000000000000",
    compensationReasonCode: "APPEAL_APPROVED"
  });

  const result = await handler.approveAppeal(
    "apl-001",
    "0xreviewer1",
    "Re-audit confirmed false positive."
  );

  assert.equal(result.status, "approved");
  assert.equal(result.reviewNote, "Re-audit confirmed false positive.");
  assert.equal(result.reviewedAt, "2026-04-10T12:00:00.000Z");
  assert.equal(result.compensationTxHash, "0xcompensated");

  assert.equal(compensationCalls.length, 1);
  assert.equal(compensationCalls[0].tokenId, "42");
});

test("approveAppeal works without compensation executor configured", async () => {
  const store = createInMemoryStore();
  seedRecord(store, { status: "under_review", reviewerAddress: "0xreviewer1" });

  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T12:00:00.000Z")
  });

  const result = await handler.approveAppeal(
    "apl-001",
    "0xreviewer1",
    "Approved without on-chain compensation."
  );

  assert.equal(result.status, "approved");
  assert.equal(result.reviewNote, "Approved without on-chain compensation.");
  assert.equal(result.compensationTxHash, undefined);
});

test("approveAppeal throws if appeal not found", async () => {
  const store = createInMemoryStore();
  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T12:00:00.000Z")
  });

  await assert.rejects(
    () => handler.approveAppeal("apl-ghost", "0xreviewer1", "ok"),
    /Appeal not found: apl-ghost/
  );
});

test("approveAppeal throws if appeal is pending (not under_review)", async () => {
  const store = createInMemoryStore();
  seedRecord(store, { status: "pending" });
  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T12:00:00.000Z")
  });

  await assert.rejects(
    () => handler.approveAppeal("apl-001", "0xreviewer1", "ok"),
    /Invalid status transition: cannot move from "pending" to "approved"/
  );
});

test("approveAppeal throws if appeal is already rejected", async () => {
  const store = createInMemoryStore();
  seedRecord(store, { status: "rejected" });
  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T12:00:00.000Z")
  });

  await assert.rejects(
    () => handler.approveAppeal("apl-001", "0xreviewer1", "ok"),
    /Invalid status transition: cannot move from "rejected" to "approved"/
  );
});

test("rejectAppeal transitions under_review -> rejected", async () => {
  const store = createInMemoryStore();
  seedRecord(store, { status: "under_review", reviewerAddress: "0xreviewer1" });

  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T12:00:00.000Z")
  });

  const result = await handler.rejectAppeal(
    "apl-001",
    "0xreviewer1",
    "Undeclared egress confirmed."
  );

  assert.equal(result.status, "rejected");
  assert.equal(result.reviewNote, "Undeclared egress confirmed.");
  assert.equal(result.reviewedAt, "2026-04-10T12:00:00.000Z");
});

test("rejectAppeal throws if appeal not found", async () => {
  const store = createInMemoryStore();
  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T12:00:00.000Z")
  });

  await assert.rejects(
    () => handler.rejectAppeal("apl-ghost", "0xreviewer1", "denied"),
    /Appeal not found: apl-ghost/
  );
});

test("rejectAppeal throws if appeal is pending (not under_review)", async () => {
  const store = createInMemoryStore();
  seedRecord(store, { status: "pending" });
  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T12:00:00.000Z")
  });

  await assert.rejects(
    () => handler.rejectAppeal("apl-001", "0xreviewer1", "denied"),
    /Invalid status transition: cannot move from "pending" to "rejected"/
  );
});

test("full lifecycle: pending -> under_review -> approved", async () => {
  const store = createInMemoryStore();
  seedRecord(store);

  const compensationCalls: AppealCompensationRequest[] = [];

  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T12:00:00.000Z"),
    compensateAppeal: async (request) => {
      compensationCalls.push(request);
      return { transactionHash: "0xfullcycle" as `0x${string}` };
    },
    compensationAmount: "100",
    compensationReasonCode: "APPEAL_APPROVED"
  });

  const afterStart = await handler.startReview("apl-001", "0xreviewer1");
  assert.equal(afterStart.status, "under_review");

  const afterApprove = await handler.approveAppeal(
    "apl-001",
    "0xreviewer1",
    "All clear."
  );
  assert.equal(afterApprove.status, "approved");
  assert.equal(afterApprove.compensationTxHash, "0xfullcycle");
  assert.equal(compensationCalls.length, 1);
});

test("full lifecycle: pending -> under_review -> rejected", async () => {
  const store = createInMemoryStore();
  seedRecord(store);

  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T12:00:00.000Z")
  });

  const afterStart = await handler.startReview("apl-001", "0xreviewer1");
  assert.equal(afterStart.status, "under_review");

  const afterReject = await handler.rejectAppeal(
    "apl-001",
    "0xreviewer1",
    "Violation confirmed."
  );
  assert.equal(afterReject.status, "rejected");
  assert.equal(afterReject.reviewNote, "Violation confirmed.");
});

test("approved appeal cannot be further transitioned", async () => {
  const store = createInMemoryStore();
  seedRecord(store, { status: "approved" });

  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T12:00:00.000Z")
  });

  await assert.rejects(
    () => handler.startReview("apl-001", "0xreviewer1"),
    /Invalid status transition/
  );
  await assert.rejects(
    () => handler.rejectAppeal("apl-001", "0xreviewer1", "nope"),
    /Invalid status transition/
  );
});

test("rejected appeal cannot be further transitioned", async () => {
  const store = createInMemoryStore();
  seedRecord(store, { status: "rejected" });

  const handler = createAppealReviewHandler({
    store,
    now: () => new Date("2026-04-10T12:00:00.000Z")
  });

  await assert.rejects(
    () => handler.startReview("apl-001", "0xreviewer1"),
    /Invalid status transition/
  );
  await assert.rejects(
    () => handler.approveAppeal("apl-001", "0xreviewer1", "ok"),
    /Invalid status transition/
  );
});
