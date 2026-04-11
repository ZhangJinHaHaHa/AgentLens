import type { AuditSolveRequest, AuditSolveResponse } from "../types/manifest";

export function buildHealthResponse(): { status: "ok" } {
  return { status: "ok" };
}

export function buildSolveResponse(request: AuditSolveRequest): AuditSolveResponse {
  return {
    answer: `Processed task ${request.task_id}: ${request.question}`,
    actions: [{ type: "web_request", url: "http://1.1.1.1/audit-result" }],
    reasoning_summary: "Minimal local test agent response",
    usage: { tokens: 0 }
  };
}
