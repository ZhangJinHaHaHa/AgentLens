import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import type {
  AppealCreateInput,
  AppealReviewInput,
  AppealTicket
} from "./persistentAppealStore";
import type { AppealCompensationExecutor } from "./appealCompensation";
import type { AppealChainWriter } from "./appealChainWriter";

export interface AppealStore {
  createAppeal(input: AppealCreateInput): Promise<AppealTicket>;
  findLatestAppeal(tokenId: string, auditId: string): Promise<AppealTicket | undefined>;
  findAppealById(appealId: string): Promise<AppealTicket | undefined>;
  reviewAppeal(appealId: string, input: AppealReviewInput): Promise<AppealTicket>;
}

export interface AppealIntakeServerOptions {
  store: AppealStore;
  compensateAppeal?: AppealCompensationExecutor;
  adminToken?: string;
  appealChainWriter?: AppealChainWriter;
}

interface AppealRequestLike extends AsyncIterable<Buffer | string> {
  method?: string;
  url?: string;
  headers?: { authorization?: string | string[]; [key: string]: string | string[] | undefined };
}

interface AppealResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

export function createAppealIntakeServer(
  options: AppealIntakeServerOptions
): Server {
  return createServer((request, response) =>
    void handleAppealIntakeRequest(request, response, options.store, options.compensateAppeal, options.adminToken, options.appealChainWriter)
  );
}

export async function handleAppealIntakeRequest(
  request: AppealRequestLike,
  response: AppealResponseLike,
  store: AppealStore,
  compensateAppeal?: AppealCompensationExecutor,
  adminToken?: string,
  appealChainWriter?: AppealChainWriter
): Promise<void> {
  if (request.method === "PATCH" && request.url?.startsWith("/api/appeals/") && request.url.endsWith("/review")) {
    if (adminToken) {
      const rawAuth = request.headers?.authorization;
      const authHeader = Array.isArray(rawAuth) ? rawAuth[0] ?? "" : rawAuth ?? "";
      if (authHeader !== `Bearer ${adminToken}`) {
        writeJson(response, 401, { error: "Unauthorized" });
        return;
      }
    }

    try {
      const appealId = parseReviewAppealId(request.url);
      const payload = parseAppealReviewPayload(await readJsonBody(request));
      const currentAppeal = await store.findAppealById(appealId);
      if (!currentAppeal) {
        throw new Error("Appeal not found.");
      }

      let compensationTxHash = payload.review.compensationTxHash;
      if (payload.compensation) {
        if (!compensateAppeal) {
          throw new Error("appeal compensation is not configured.");
        }

        const compensation = await compensateAppeal({
          tokenId: currentAppeal.tokenId,
          auditId: currentAppeal.auditId,
          amount: payload.compensation.amount,
          reasonCode: payload.compensation.reasonCode
        });
        compensationTxHash = compensation.transactionHash;
      }

      const updated = await store.reviewAppeal(appealId, {
        ...payload.review,
        ...(compensationTxHash ? { compensationTxHash } : {})
      });
      writeJson(response, 200, {
        appealId: updated.appealId,
        status: updated.status,
        ...(updated.compensationTxHash ? { compensationTxHash: updated.compensationTxHash } : {})
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid appeal review request.";
      writeJson(response, message === "Appeal not found." ? 404 : 400, {
        error: message
      });
    }

    return;
  }

  if (request.method === "GET" && request.url?.startsWith("/api/appeals?")) {
    try {
      const { tokenId, auditId } = parseAppealLookupUrl(request.url);
      const ticket = await store.findLatestAppeal(tokenId, auditId);

      if (!ticket) {
        writeJson(response, 404, { error: "Appeal not found." });
        return;
      }

      writeJson(response, 200, {
        appealId: ticket.appealId,
        status: ticket.status,
        createdAt: ticket.createdAt
      });
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : "Invalid appeal lookup request."
      });
    }

    return;
  }

  if (request.method === "POST" && request.url === "/api/appeals") {
    try {
      const payload = parseAppealPayload(await readJsonBody(request));
      const created = await store.createAppeal(payload);

      // Write appeal to chain (V2) — non-fatal
      if (appealChainWriter) {
        try {
          await appealChainWriter.fileAppealOnChain({
            tokenId: payload.tokenId,
            auditId: payload.auditId,
            evidenceHash: created.reportHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
            appealCID: created.appealId
          });
        } catch (chainErr) {
          console.error("[appealIntakeServer] fileAppealOnChain failed:", chainErr);
        }
      }

      writeJson(response, 202, {
        appealId: created.appealId,
        status: created.status
      });
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : "Invalid appeal request."
      });
    }

    return;
  }

  writeJson(response, 404, { error: "not found" });
}

function parseReviewAppealId(url: string): string {
  const match = /^\/api\/appeals\/([^/]+)\/review$/.exec(url);
  if (!match || match[1].trim().length === 0) {
    throw new Error("appealId is required.");
  }

  return decodeURIComponent(match[1]);
}

async function readJsonBody(request: AppealRequestLike): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (rawBody.length === 0) {
    return {};
  }

  return JSON.parse(rawBody);
}

function writeJson(response: AppealResponseLike, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(`${JSON.stringify(body)}\n`);
}

function parseAppealPayload(payload: unknown): AppealCreateInput {
  if (!payload || typeof payload !== "object") {
    throw new Error("Appeal payload must be a JSON object.");
  }

  const record = payload as Record<string, unknown>;
  const tokenId = readRequiredDecimalString(record, "tokenId");
  const auditId = readRequiredDecimalString(record, "auditId");
  const auditIndex = readRequiredAuditIndex(record.auditIndex);
  const reason = readRequiredReason(record.reason);

  return {
    tokenId,
    auditId,
    auditIndex,
    reason,
    ...(readOptionalString(record.reportCID) ? { reportCID: readOptionalString(record.reportCID) } : {}),
    ...(readOptionalString(record.reportHash) ? { reportHash: readOptionalString(record.reportHash) } : {}),
    ...(readOptionalString(record.manifestUrl) ? { manifestUrl: readOptionalString(record.manifestUrl) } : {})
  };
}

function parseAppealLookupUrl(url: string): { tokenId: string; auditId: string } {
  const parsed = new URL(url, "http://appeal.local");
  const tokenId = parsed.searchParams.get("tokenId");
  const auditId = parsed.searchParams.get("auditId");

  if (!tokenId || !/^\d+$/.test(tokenId.trim())) {
    throw new Error("tokenId must be a non-empty decimal string.");
  }

  if (!auditId || !/^\d+$/.test(auditId.trim())) {
    throw new Error("auditId must be a non-empty decimal string.");
  }

  return {
    tokenId: tokenId.trim(),
    auditId: auditId.trim()
  };
}

function parseAppealReviewPayload(payload: unknown): {
  review: AppealReviewInput;
  compensation?: {
    amount: string;
    reasonCode: string;
  };
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("Appeal review payload must be a JSON object.");
  }

  const record = payload as Record<string, unknown>;
  const status = readReviewStatus(record.status);
  const reviewer = readNonEmptyString(record.reviewer, "reviewer");
  const reviewResult = readNonEmptyString(record.reviewResult, "reviewResult");

  const compensationTxHash = readOptionalString(record.compensationTxHash);

  if (status === "approved") {
    const compensationAmount = readOptionalDecimalString(record.compensationAmount);
    const compensationReasonCode = readOptionalString(record.compensationReasonCode);

    if (!compensationAmount || !compensationReasonCode) {
      throw new Error("approved appeals require compensationAmount and compensationReasonCode.");
    }

    return {
      review: {
        status,
        reviewer,
        reviewResult,
        ...(compensationTxHash ? { compensationTxHash } : {})
      },
      compensation: {
        amount: compensationAmount,
        reasonCode: compensationReasonCode
      }
    };
  }

  return {
    review: {
      status,
      reviewer,
      reviewResult,
      ...(compensationTxHash ? { compensationTxHash } : {})
    }
  };
}

function readRequiredDecimalString(
  record: Record<string, unknown>,
  field: "tokenId" | "auditId"
): string {
  const value = record[field];
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    throw new Error(`${field} must be a non-empty decimal string.`);
  }

  return value.trim();
}

function readRequiredAuditIndex(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("auditIndex must be a non-negative safe integer.");
  }

  return value;
}

function readRequiredReason(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("reason must be a non-empty string.");
  }

  return value.trim();
}

function readReviewStatus(value: unknown): "approved" | "rejected" {
  if (value === "approved" || value === "rejected") {
    return value;
  }

  throw new Error("status must be either approved or rejected.");
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readOptionalDecimalString(value: unknown): string | undefined {
  return typeof value === "string" && /^\d+$/u.test(value.trim()) ? value.trim() : undefined;
}
