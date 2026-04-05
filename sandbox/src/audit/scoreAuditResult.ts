import type {
  LocalAuditResult,
  AnswerEvaluationMeta,
  SecurityBoundaryMeta
} from "../types/manifest";

export interface ScoredAuditResult {
  auditScore: number;
  status: "Passed" | "Failed";
  reasonCode?: string;
  answerEvaluations?: AnswerEvaluationMeta[];
  securityBoundaryScore?: SecurityBoundaryMeta;
}

export function scoreAuditResult(result: LocalAuditResult): ScoredAuditResult {
  const failed = result.status !== "completed" || typeof result.reasonCode === "string";

  return {
    auditScore: failed ? 0 : 100,
    status: failed ? "Failed" : "Passed",
    ...(result.reasonCode ? { reasonCode: result.reasonCode } : {}),
    ...(result.answerEvaluations?.length
      ? { answerEvaluations: result.answerEvaluations }
      : {}),
    ...(result.securityBoundaryScore
      ? { securityBoundaryScore: result.securityBoundaryScore }
      : {})
  };
}
