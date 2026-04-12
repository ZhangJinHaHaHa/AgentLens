import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";

import {
  handleAppealIntakeRequest,
  type AppealStore
} from "../../src/appeal/appealIntakeServer";
import type { AppealTicket } from "../../src/appeal/persistentAppealStore";

function createStoreDouble(): {
  store: AppealStore;
  created: AppealTicket[];
} {
  const created: AppealTicket[] = [];

  return {
    created,
    store: {
      async createAppeal(input) {
        const ticket: AppealTicket = {
          appealId: "apl-001",
          status: "reviewing",
          createdAt: "2026-03-30T10:20:00.000Z",
          ...input
        };
        created.push(ticket);
        return ticket;
      },
      async findLatestAppeal(tokenId, auditId) {
        return created.find(
          (appeal) => appeal.tokenId === tokenId && appeal.auditId === auditId
        );
      },
      async findAppealById(appealId) {
        return created.find((appeal) => appeal.appealId === appealId);
      },
      async reviewAppeal(appealId, input) {
        const index = created.findIndex((appeal) => appeal.appealId === appealId);
        assert.notEqual(index, -1);
        const updated = {
          ...created[index],
          ...input,
          reviewedAt: "2026-03-30T10:25:00.000Z"
        } satisfies AppealTicket;
        created[index] = updated;
        return updated;
      }
    }
  };
}

test("createAppealIntakeServer accepts POST /api/appeals and returns a queued appeal", async () => {
  const { store, created } = createStoreDouble();
  const response = createResponseDouble();

  await handleAppealIntakeRequest(
    createRequestDouble("POST", "/api/appeals", {
      tokenId: "1",
      auditId: "2",
      auditIndex: 0,
      reason: "Need a manual review for this slash.",
      reportCID: "bafy-report",
      reportHash: "0x1234",
      manifestUrl: "https://example.com/manifest.json"
    }),
    response,
    store
  );

  assert.equal(response.statusCode, 202);
  assert.deepEqual(response.jsonBody, {
    appealId: "apl-001",
    status: "reviewing"
  });
  assert.deepEqual(created, [
    {
      appealId: "apl-001",
      tokenId: "1",
      auditId: "2",
      auditIndex: 0,
      reason: "Need a manual review for this slash.",
      reportCID: "bafy-report",
      reportHash: "0x1234",
      manifestUrl: "https://example.com/manifest.json",
      status: "reviewing",
      createdAt: "2026-03-30T10:20:00.000Z"
    }
  ]);
});

test("createAppealIntakeServer rejects invalid appeal payloads", async () => {
  const { store, created } = createStoreDouble();
  const response = createResponseDouble();

  await handleAppealIntakeRequest(
    createRequestDouble("POST", "/api/appeals", {
      tokenId: "1",
      auditId: "not-a-number",
      auditIndex: -1,
      reason: ""
    }),
    response,
    store
  );

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.jsonBody, {
    error: "auditId must be a non-empty decimal string."
  });
  assert.deepEqual(created, []);
});

test("createAppealIntakeServer returns the latest appeal for tokenId and auditId", async () => {
  const { store, created } = createStoreDouble();
  created.push({
    appealId: "apl-001",
    tokenId: "1",
    auditId: "2",
    auditIndex: 0,
    reason: "Need a manual review for this slash.",
    reportCID: "bafy-report",
    reportHash: "0x1234",
    manifestUrl: "https://example.com/manifest.json",
    status: "reviewing",
    createdAt: "2026-03-30T10:20:00.000Z"
  });
  const response = createResponseDouble();

  await handleAppealIntakeRequest(
    createRequestDouble("GET", "/api/appeals?tokenId=1&auditId=2", undefined),
    response,
    store
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody, {
    appealId: "apl-001",
    status: "reviewing",
    createdAt: "2026-03-30T10:20:00.000Z"
  });
});

test("createAppealIntakeServer returns 404 when no appeal exists for tokenId and auditId", async () => {
  const { store } = createStoreDouble();
  const response = createResponseDouble();

  await handleAppealIntakeRequest(
    createRequestDouble("GET", "/api/appeals?tokenId=1&auditId=2", undefined),
    response,
    store
  );

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.jsonBody, {
    error: "Appeal not found."
  });
});

test("createAppealIntakeServer updates an appeal review result", async () => {
  const { store, created } = createStoreDouble();
  created.push({
    appealId: "apl-001",
    tokenId: "1",
    auditId: "2",
    auditIndex: 0,
    reason: "Need a manual review for this slash.",
    status: "reviewing",
    createdAt: "2026-03-30T10:20:00.000Z"
  });
  const response = createResponseDouble();

  await handleAppealIntakeRequest(
    createRequestDouble("PATCH", "/api/appeals/apl-001/review", {
      status: "rejected",
      reviewer: "operator-1",
      reviewResult: "Observed undeclared egress was confirmed."
    }),
    response,
    store
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody, {
    appealId: "apl-001",
    status: "rejected"
  });
});

test("createAppealIntakeServer executes on-chain compensation when an appeal is approved", async () => {
  const { store, created } = createStoreDouble();
  created.push({
    appealId: "apl-001",
    tokenId: "1",
    auditId: "2",
    auditIndex: 0,
    reason: "Need a manual review for this slash.",
    status: "reviewing",
    createdAt: "2026-03-30T10:20:00.000Z"
  });
  const response = createResponseDouble();
  const compensationRequests: Array<{
    tokenId: string;
    auditId: string;
    amount: string;
    reasonCode: string;
  }> = [];

  await handleAppealIntakeRequest(
    createRequestDouble("PATCH", "/api/appeals/apl-001/review", {
      status: "approved",
      reviewer: "operator-1",
      reviewResult: "False positive confirmed.",
      compensationAmount: "400000000000000000",
      compensationReasonCode: "APPEAL_APPROVED"
    }),
    response,
    store,
    async (request) => {
      compensationRequests.push(request);
      return {
        transactionHash: "0xcompensated"
      };
    }
  );

  assert.deepEqual(compensationRequests, [
    {
      tokenId: "1",
      auditId: "2",
      amount: "400000000000000000",
      reasonCode: "APPEAL_APPROVED"
    }
  ]);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody, {
    appealId: "apl-001",
    status: "approved",
    compensationTxHash: "0xcompensated"
  });
});

// ---------------------------------------------------------------------------
// Admin token authentication tests
// ---------------------------------------------------------------------------

test("PATCH review returns 401 when adminToken is configured but no token provided", async () => {
  const { store, created } = createStoreDouble();
  created.push({
    appealId: "apl-001",
    tokenId: "1",
    auditId: "2",
    auditIndex: 0,
    reason: "Test",
    status: "reviewing",
    createdAt: "2026-03-30T10:20:00.000Z"
  });
  const response = createResponseDouble();

  await handleAppealIntakeRequest(
    createRequestDouble("PATCH", "/api/appeals/apl-001/review", {
      status: "rejected",
      reviewer: "operator-1",
      reviewResult: "test"
    }),
    response,
    store,
    undefined,
    "secret-admin-token"
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.jsonBody, { error: "Unauthorized" });
});

test("PATCH review returns 401 when adminToken is configured and wrong token provided", async () => {
  const { store, created } = createStoreDouble();
  created.push({
    appealId: "apl-001",
    tokenId: "1",
    auditId: "2",
    auditIndex: 0,
    reason: "Test",
    status: "reviewing",
    createdAt: "2026-03-30T10:20:00.000Z"
  });
  const response = createResponseDouble();

  await handleAppealIntakeRequest(
    createRequestDouble("PATCH", "/api/appeals/apl-001/review", {
      status: "rejected",
      reviewer: "operator-1",
      reviewResult: "test"
    }, { authorization: "Bearer wrong-token" }),
    response,
    store,
    undefined,
    "secret-admin-token"
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.jsonBody, { error: "Unauthorized" });
});

test("PATCH review succeeds when adminToken is configured and correct token provided", async () => {
  const { store, created } = createStoreDouble();
  created.push({
    appealId: "apl-001",
    tokenId: "1",
    auditId: "2",
    auditIndex: 0,
    reason: "Test",
    status: "reviewing",
    createdAt: "2026-03-30T10:20:00.000Z"
  });
  const response = createResponseDouble();

  await handleAppealIntakeRequest(
    createRequestDouble("PATCH", "/api/appeals/apl-001/review", {
      status: "rejected",
      reviewer: "operator-1",
      reviewResult: "Confirmed."
    }, { authorization: "Bearer secret-admin-token" }),
    response,
    store,
    undefined,
    "secret-admin-token"
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody, {
    appealId: "apl-001",
    status: "rejected"
  });
});

test("PATCH review remains open when adminToken is not configured (backward compat)", async () => {
  const { store, created } = createStoreDouble();
  created.push({
    appealId: "apl-001",
    tokenId: "1",
    auditId: "2",
    auditIndex: 0,
    reason: "Test",
    status: "reviewing",
    createdAt: "2026-03-30T10:20:00.000Z"
  });
  const response = createResponseDouble();

  await handleAppealIntakeRequest(
    createRequestDouble("PATCH", "/api/appeals/apl-001/review", {
      status: "rejected",
      reviewer: "operator-1",
      reviewResult: "No issue found."
    }),
    response,
    store
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody, {
    appealId: "apl-001",
    status: "rejected"
  });
});

test("GET and POST are not affected by adminToken", async () => {
  const { store } = createStoreDouble();
  const adminToken = "secret-admin-token";

  // POST should work without token
  const postResponse = createResponseDouble();
  await handleAppealIntakeRequest(
    createRequestDouble("POST", "/api/appeals", {
      tokenId: "1",
      auditId: "2",
      auditIndex: 0,
      reason: "Test appeal"
    }),
    postResponse,
    store,
    undefined,
    adminToken
  );
  assert.equal(postResponse.statusCode, 202);

  // GET should work without token
  const getResponse = createResponseDouble();
  await handleAppealIntakeRequest(
    createRequestDouble("GET", "/api/appeals?tokenId=1&auditId=2", undefined),
    getResponse,
    store,
    undefined,
    adminToken
  );
  assert.equal(getResponse.statusCode, 200);
});

test("createAppealIntakeServer rejects approved reviews without compensation details", async () => {
  const { store, created } = createStoreDouble();
  created.push({
    appealId: "apl-001",
    tokenId: "1",
    auditId: "2",
    auditIndex: 0,
    reason: "Need a manual review for this slash.",
    status: "reviewing",
    createdAt: "2026-03-30T10:20:00.000Z"
  });
  const response = createResponseDouble();

  await handleAppealIntakeRequest(
    createRequestDouble("PATCH", "/api/appeals/apl-001/review", {
      status: "approved",
      reviewer: "operator-1",
      reviewResult: "False positive confirmed."
    }),
    response,
    store
  );

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.jsonBody, {
    error: "approved appeals require compensationAmount and compensationReasonCode."
  });
});

function createRequestDouble(method: string, url: string, body: unknown, headers?: Record<string, string>): Readable & {
  method: string;
  url: string;
  headers?: Record<string, string>;
} {
  const request = Readable.from([JSON.stringify(body)]) as Readable & {
    method: string;
    url: string;
    headers?: Record<string, string>;
  };
  request.method = method;
  request.url = url;
  if (headers) {
    request.headers = headers;
  }
  return request;
}

function createResponseDouble(): {
  statusCode: number;
  headers: Record<string, string>;
  jsonBody: unknown;
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
