import { SOLVE_PATH } from "../config/constants";
import type { AuditSolveRequest, AuditSolveResponse } from "../types/manifest";

export class ProtocolViolationError extends Error {
  readonly reasonCode = "PROTOCOL_VIOLATION";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProtocolViolationError";
  }
}

export type FetchLike = typeof fetch;

export interface SendAuditRequestOptions {
  host: string;
  port: number;
  request: AuditSolveRequest;
  timeoutMs: number;
  fetchImpl?: FetchLike;
}

function isAuditSolveResponse(value: unknown): value is AuditSolveResponse {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.answer === "string" &&
    Array.isArray(record.actions) &&
    record.actions.every(
      (action) =>
        action !== null &&
        typeof action === "object" &&
        !Array.isArray(action) &&
        typeof (action as Record<string, unknown>).type === "string"
    )
  );
}

export async function sendAuditRequest(options: SendAuditRequestOptions): Promise<AuditSolveResponse> {
  const { host, port, request, timeoutMs, fetchImpl = fetch } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`http://${host}:${port}${SOLVE_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    let parsedBody: unknown;

    try {
      parsedBody = await response.json();
    } catch (error) {
      throw new ProtocolViolationError("Audit response is not valid JSON", { cause: error });
    }

    if (!response.ok) {
      throw new ProtocolViolationError(`Audit response returned status ${response.status}`);
    }

    if (!isAuditSolveResponse(parsedBody)) {
      throw new ProtocolViolationError("Audit response does not match the expected schema");
    }

    return parsedBody;
  } catch (error) {
    if (error instanceof ProtocolViolationError) {
      throw error;
    }

    throw new ProtocolViolationError("Audit request failed", { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
