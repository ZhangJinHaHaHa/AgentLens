import type { LocalAuditResult } from "../types/manifest";

export interface ScoredAuditResult {
  auditScore: number;
  status: "Passed" | "Failed";
  reasonCode?: string;
}

export function scoreAuditResult(result: LocalAuditResult): ScoredAuditResult {
  const failed = result.status !== "completed" || typeof result.reasonCode === "string";

  return {
    auditScore: failed ? 0 : 100,
    status: failed ? "Failed" : "Passed",
    ...(result.reasonCode ? { reasonCode: result.reasonCode } : {})
  };
}
