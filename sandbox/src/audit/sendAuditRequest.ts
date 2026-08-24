/**
 * 这是审计控制器到受审 agent `/solve` 端点的 HTTP 协议边界，负责超时、JSON 传输和最小响应形态校验。
 * host/port/request 来自沙箱编排，状态码和响应体来自受审进程；只有 answer 为字符串且每个 action 至少含字符串 type 才能越过本层。
 * 该校验刻意不判断动作是否获授权或符合 manifest，后续网络对账与分类器必须继续处理语义风险，不能把 schema 合法视为审计通过。
 * 非 JSON、非成功状态、形态异常、超时及传输错误统一包装为带稳定 reasonCode 的 `ProtocolViolationError`，同时保留 cause 供内部诊断。
 * 定时器在所有路径清理；本层不自动重试，因远端可能已处理请求，失败时也无法回滚受审进程的外部副作用。
 */
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
