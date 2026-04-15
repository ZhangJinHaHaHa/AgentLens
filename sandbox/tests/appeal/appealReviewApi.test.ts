import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";

import {
  handleAppealReviewRequest,
  type AppealReviewApiDependencies
} from "../../src/appeal/appealReviewApi";
import type {
  AppealReviewRecord,
  AppealReviewStatus
} from "../../src/appeal/appealReviewTypes";
import type { AppealCompensationRequest } from "../../src/appeal/appealCompensation";

function createInMemoryDeps(
  records: AppealReviewRecord[] = [],
  compensateAppeal?: AppealReviewApiDependencies["compensateAppeal"]
): AppealReviewApiDependencies {
  const store = new Map<string, AppealReviewRecord>();
  for (const record of records) {
    store.set(record.appealId, record);
  }

  return {
    store: {
      async findById(appealId: string) {
        return store.get(appealId);
      },
      async update(appealId: string, fields: Partial<AppealReviewRecord>) {
        const existing = store.get(appealId);
        if (!existing) {
          throw new Error(`Appeal review record not found: ${appealId}`);
        }

        const updated: AppealReviewRecord = { ...existing, ...fields };
        store.set(appealId, updated);
        return updated;
      },
      async listAll() {
        return Array.from(store.values());
      },
      async listByStatus(status: AppealReviewStatus) {
        return Array.from(store.values()).filter((r) => r.status === status);
      }
    },
    now: () => new Date("2026-04-10T12:00:00.000Z"),
    compensateAppeal,
    compensationAmount: "500000000000000000",
    compensationReasonCode: "APPEAL_APPROVED"
  };
}

function makePendingRecord(overrides: Partial<AppealReviewRecord> = {}): AppealReviewRecord {
  return {
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
}

test("GET /appeals returns all appeals", async () => {
  const records = [
    makePendingRecord({ appealId: "apl-001" }),
    makePendingRecord({ appealId: "apl-002", status: "under_review" })
  ];
  const deps = createInMemoryDeps(records);
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("GET", "/appeals", undefined),
    response,
    deps
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody.length, 2);
});

test("GET /appeals?status=pending filters by status", async () => {
  const records = [
    makePendingRecord({ appealId: "apl-001" }),
    makePendingRecord({ appealId: "apl-002", status: "under_review" })
  ];
  const deps = createInMemoryDeps(records);
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("GET", "/appeals?status=pending", undefined),
    response,
    deps
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody.length, 1);
  assert.equal(response.jsonBody[0].appealId, "apl-001");
  assert.equal(response.jsonBody[0].status, "pending");
});

test("GET /appeals/:appealId returns a single appeal", async () => {
  const records = [makePendingRecord()];
  const deps = createInMemoryDeps(records);
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("GET", "/appeals/apl-001", undefined),
    response,
    deps
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody.appealId, "apl-001");
  assert.equal(response.jsonBody.status, "pending");
});

test("GET /appeals/:appealId returns 404 for unknown appeal", async () => {
  const deps = createInMemoryDeps([]);
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("GET", "/appeals/apl-ghost", undefined),
    response,
    deps
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.jsonBody.error, "Appeal not found.");
});

test("POST /appeals/:appealId/review starts review", async () => {
  const records = [makePendingRecord()];
  const deps = createInMemoryDeps(records);
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("POST", "/appeals/apl-001/review", {
      reviewerAddress: "0xreviewer1"
    }),
    response,
    deps
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody.appealId, "apl-001");
  assert.equal(response.jsonBody.status, "under_review");
  assert.equal(response.jsonBody.reviewerAddress, "0xreviewer1");
});

test("POST /appeals/:appealId/review returns 400 for missing reviewerAddress", async () => {
  const records = [makePendingRecord()];
  const deps = createInMemoryDeps(records);
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("POST", "/appeals/apl-001/review", {}),
    response,
    deps
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.jsonBody.error, /reviewerAddress/);
});

test("POST /appeals/:appealId/review returns 404 for unknown appeal", async () => {
  const deps = createInMemoryDeps([]);
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("POST", "/appeals/apl-ghost/review", {
      reviewerAddress: "0xreviewer1"
    }),
    response,
    deps
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.jsonBody.error, "Appeal not found: apl-ghost");
});

test("POST /appeals/:appealId/approve approves and triggers compensation", async () => {
  const records = [
    makePendingRecord({ status: "under_review", reviewerAddress: "0xreviewer1" })
  ];
  const compensationCalls: AppealCompensationRequest[] = [];

  const deps = createInMemoryDeps(records, async (request) => {
    compensationCalls.push(request);
    return { transactionHash: "0xcompensated" as `0x${string}` };
  });
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("POST", "/appeals/apl-001/approve", {
      reviewerAddress: "0xreviewer1",
      note: "Confirmed false positive."
    }),
    response,
    deps
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody.appealId, "apl-001");
  assert.equal(response.jsonBody.status, "approved");
  assert.equal(response.jsonBody.compensationTxHash, "0xcompensated");

  assert.equal(compensationCalls.length, 1);
  assert.equal(compensationCalls[0].tokenId, "42");
  assert.equal(compensationCalls[0].amount, "500000000000000000");
});

test("POST /appeals/:appealId/approve returns 400 for invalid transition", async () => {
  const records = [makePendingRecord({ status: "pending" })];
  const deps = createInMemoryDeps(records);
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("POST", "/appeals/apl-001/approve", {
      reviewerAddress: "0xreviewer1",
      note: "ok"
    }),
    response,
    deps
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.jsonBody.error, /Invalid status transition/);
});

test("POST /appeals/:appealId/reject rejects the appeal", async () => {
  const records = [
    makePendingRecord({ status: "under_review", reviewerAddress: "0xreviewer1" })
  ];
  const deps = createInMemoryDeps(records);
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("POST", "/appeals/apl-001/reject", {
      reviewerAddress: "0xreviewer1",
      note: "Violation confirmed."
    }),
    response,
    deps
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody.appealId, "apl-001");
  assert.equal(response.jsonBody.status, "rejected");
  assert.equal(response.jsonBody.reviewNote, "Violation confirmed.");
});

test("POST /appeals/:appealId/reject returns 400 for missing note", async () => {
  const records = [
    makePendingRecord({ status: "under_review", reviewerAddress: "0xreviewer1" })
  ];
  const deps = createInMemoryDeps(records);
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("POST", "/appeals/apl-001/reject", {
      reviewerAddress: "0xreviewer1"
    }),
    response,
    deps
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.jsonBody.error, /note/);
});

test("POST /appeals/:appealId/reject returns 404 for unknown appeal", async () => {
  const deps = createInMemoryDeps([]);
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("POST", "/appeals/apl-ghost/reject", {
      reviewerAddress: "0xreviewer1",
      note: "nope"
    }),
    response,
    deps
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.jsonBody.error, "Appeal not found: apl-ghost");
});

test("unknown route returns 404", async () => {
  const deps = createInMemoryDeps([]);
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("DELETE", "/appeals/apl-001", undefined),
    response,
    deps
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.jsonBody.error, "Not found.");
});

test("GET /appeals?status=invalid returns 400", async () => {
  const deps = createInMemoryDeps([]);
  const response = createResponseDouble();

  await handleAppealReviewRequest(
    createRequestDouble("GET", "/appeals?status=invalid", undefined),
    response,
    deps
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.jsonBody.error, /Invalid status filter/);
});

function createRequestDouble(
  method: string,
  url: string,
  body: unknown
): Readable & { method: string; url: string } {
  const request = Readable.from(
    body !== undefined ? [JSON.stringify(body)] : [""]
  ) as Readable & {
    method: string;
    url: string;
  };
  request.method = method;
  request.url = url;
  return request;
}

function createResponseDouble(): {
  statusCode: number;
  headers: Record<string, string>;
  jsonBody: any;
  setHeader(name: string, value: string): void;
  end(body: string): void;
} {
  return {
    statusCode: 200,
    headers: {},
    jsonBody: undefined,
    setHeader(name: string, value: string): void {
      this.headers[name] = value;
    },
    end(body: string): void {
      this.jsonBody = JSON.parse(body);
    }
  };
}
