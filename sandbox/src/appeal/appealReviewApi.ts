import type {
  AppealCompensationExecutor
} from "./appealCompensation";
import {
  createAppealReviewHandler,
  type AppealReviewHandler
} from "./appealReviewHandler";
import type {
  AppealReviewRecord,
  AppealReviewStatus
} from "./appealReviewTypes";
import type { AppealReviewStore } from "./appealReviewStore";

export interface AppealReviewApiDependencies {
  readonly store: Pick<
    AppealReviewStore,
    "findById" | "update" | "listAll" | "listByStatus"
  >;
  readonly now?: () => Date;
  readonly compensateAppeal?: AppealCompensationExecutor;
  readonly compensationAmount?: string;
  readonly compensationReasonCode?: string;
}

interface ReviewRequestLike extends AsyncIterable<Buffer | string> {
  method?: string;
  url?: string;
}

interface ReviewResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

const VALID_STATUSES: readonly AppealReviewStatus[] = [
  "pending",
  "under_review",
  "approved",
  "rejected"
];

function isValidStatusFilter(value: string): value is AppealReviewStatus {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

function parseAppealIdFromPath(
  url: string,
  suffix: string
): string | undefined {
  const pattern = new RegExp(`^/appeals/([^/]+)${suffix}$`);
  const match = pattern.exec(url.split("?")[0]);
  if (!match || match[1].trim().length === 0) {
    return undefined;
  }

  return decodeURIComponent(match[1]);
}

function isAppealDetailPath(url: string): boolean {
  const path = url.split("?")[0];
  return /^\/appeals\/[^/]+$/.test(path);
}

function parseAppealIdFromDetailPath(url: string): string {
  const path = url.split("?")[0];
  const match = /^\/appeals\/([^/]+)$/.exec(path);
  if (!match || match[1].trim().length === 0) {
    throw new Error("appealId is required.");
  }

  return decodeURIComponent(match[1]);
}

async function readJsonBody(request: ReviewRequestLike): Promise<unknown> {
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

function writeJson(
  response: ReviewResponseLike,
  statusCode: number,
  body: unknown
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(`${JSON.stringify(body)}\n`);
}

function readRequiredString(
  payload: Record<string, unknown>,
  field: string
): string {
  const value = payload[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalString(
  payload: Record<string, unknown>,
  field: string
): string | undefined {
  const value = payload[field];
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value.trim();
}

function buildHandler(deps: AppealReviewApiDependencies): AppealReviewHandler {
  return createAppealReviewHandler({
    store: deps.store,
    now: deps.now,
    compensateAppeal: deps.compensateAppeal,
    compensationAmount: deps.compensationAmount,
    compensationReasonCode: deps.compensationReasonCode
  });
}

function formatRecord(record: AppealReviewRecord): Record<string, unknown> {
  return {
    appealId: record.appealId,
    eventKey: record.eventKey,
    tokenId: record.tokenId,
    status: record.status,
    reason: record.reason,
    slashReasonCode: record.slashReasonCode,
    originalAuditScore: record.originalAuditScore,
    createdAt: record.createdAt,
    ...(record.reviewerAddress
      ? { reviewerAddress: record.reviewerAddress }
      : {}),
    ...(record.reviewNote ? { reviewNote: record.reviewNote } : {}),
    ...(record.reviewedAt ? { reviewedAt: record.reviewedAt } : {}),
    ...(record.compensationTxHash
      ? { compensationTxHash: record.compensationTxHash }
      : {})
  };
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.startsWith("Appeal not found:")
  );
}

function isTransitionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith("Invalid status transition:")
  );
}

export async function handleAppealReviewRequest(
  request: ReviewRequestLike,
  response: ReviewResponseLike,
  deps: AppealReviewApiDependencies
): Promise<void> {
  const method = request.method ?? "";
  const url = request.url ?? "";
  const path = url.split("?")[0];

  // GET /appeals or GET /appeals?status=...
  if (method === "GET" && path === "/appeals") {
    try {
      const parsed = new URL(url, "http://review.local");
      const statusFilter = parsed.searchParams.get("status");

      if (statusFilter) {
        if (!isValidStatusFilter(statusFilter)) {
          writeJson(response, 400, {
            error: `Invalid status filter: "${statusFilter}". Must be one of: ${VALID_STATUSES.join(", ")}.`
          });
          return;
        }

        const records = await deps.store.listByStatus(statusFilter);
        writeJson(
          response,
          200,
          records.map(formatRecord)
        );
        return;
      }

      const records = await deps.store.listAll();
      writeJson(
        response,
        200,
        records.map(formatRecord)
      );
    } catch (error) {
      writeJson(response, 500, {
        error:
          error instanceof Error
            ? error.message
            : "Failed to list appeals."
      });
    }

    return;
  }

  // GET /appeals/:appealId
  if (method === "GET" && isAppealDetailPath(url)) {
    try {
      const appealId = parseAppealIdFromDetailPath(url);
      const record = await deps.store.findById(appealId);

      if (!record) {
        writeJson(response, 404, { error: "Appeal not found." });
        return;
      }

      writeJson(response, 200, formatRecord(record));
    } catch (error) {
      writeJson(response, 400, {
        error:
          error instanceof Error
            ? error.message
            : "Failed to read appeal."
      });
    }

    return;
  }

  // POST /appeals/:appealId/review
  if (method === "POST") {
    const reviewAppealId = parseAppealIdFromPath(url, "/review");
    if (reviewAppealId) {
      try {
        const payload = (await readJsonBody(request)) as Record<
          string,
          unknown
        >;
        const reviewerAddress = readRequiredString(payload, "reviewerAddress");
        const handler = buildHandler(deps);
        const result = await handler.startReview(
          reviewAppealId,
          reviewerAddress
        );
        writeJson(response, 200, formatRecord(result));
      } catch (error) {
        if (isNotFoundError(error)) {
          writeJson(response, 404, {
            error: (error as Error).message
          });
          return;
        }

        writeJson(response, 400, {
          error:
            error instanceof Error
              ? error.message
              : "Failed to start review."
        });
      }

      return;
    }

    // POST /appeals/:appealId/approve
    const approveAppealId = parseAppealIdFromPath(url, "/approve");
    if (approveAppealId) {
      try {
        const payload = (await readJsonBody(request)) as Record<
          string,
          unknown
        >;
        const reviewerAddress = readRequiredString(payload, "reviewerAddress");
        const note = readRequiredString(payload, "note");
        const handler = buildHandler(deps);
        const result = await handler.approveAppeal(
          approveAppealId,
          reviewerAddress,
          note
        );
        writeJson(response, 200, formatRecord(result));
      } catch (error) {
        if (isNotFoundError(error)) {
          writeJson(response, 404, {
            error: (error as Error).message
          });
          return;
        }

        if (isTransitionError(error)) {
          writeJson(response, 400, {
            error: (error as Error).message
          });
          return;
        }

        writeJson(response, 400, {
          error:
            error instanceof Error
              ? error.message
              : "Failed to approve appeal."
        });
      }

      return;
    }

    // POST /appeals/:appealId/reject
    const rejectAppealId = parseAppealIdFromPath(url, "/reject");
    if (rejectAppealId) {
      try {
        const payload = (await readJsonBody(request)) as Record<
          string,
          unknown
        >;
        const reviewerAddress = readRequiredString(payload, "reviewerAddress");
        const note = readRequiredString(payload, "note");
        const handler = buildHandler(deps);
        const result = await handler.rejectAppeal(
          rejectAppealId,
          reviewerAddress,
          note
        );
        writeJson(response, 200, formatRecord(result));
      } catch (error) {
        if (isNotFoundError(error)) {
          writeJson(response, 404, {
            error: (error as Error).message
          });
          return;
        }

        if (isTransitionError(error)) {
          writeJson(response, 400, {
            error: (error as Error).message
          });
          return;
        }

        writeJson(response, 400, {
          error:
            error instanceof Error
              ? error.message
              : "Failed to reject appeal."
        });
      }

      return;
    }
  }

  writeJson(response, 404, { error: "Not found." });
}
