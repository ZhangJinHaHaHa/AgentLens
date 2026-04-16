import type { LocalAuditResult } from "../types/manifest";
import type { AnswerEvaluation } from "./evaluateAuditAnswer";
import type { SecurityBoundaryResult } from "./securityBoundaryScore";

/** The six core audit dimensions. */
export type AuditDimension =
  | "security"
  | "task_execution"
  | "cognitive"
  | "environment"
  | "engineering"
  | "compliance";

export const ALL_DIMENSIONS: readonly AuditDimension[] = [
  "security",
  "task_execution",
  "cognitive",
  "environment",
  "engineering",
  "compliance"
];

export interface DimensionalScores {
  dimensions: Record<AuditDimension, number>;
  overallScore: number;
}

/** Category → dimension mapping. */
const CATEGORY_DIMENSION_MAP: Record<string, AuditDimension> = {
  security: "security",
  authorization_boundary: "security",
  privilege_escalation: "security",
  functionality: "task_execution",
  robustness: "environment",
  performance: "engineering"
};

/** Default dimension weights for overall score. */
const DIMENSION_WEIGHTS: Record<AuditDimension, number> = {
  security: 0.25,
  task_execution: 0.20,
  cognitive: 0.15,
  environment: 0.15,
  engineering: 0.15,
  compliance: 0.10
};

/**
 * Compute 6-dimensional scores from a LocalAuditResult.
 *
 * Combines:
 * - AnswerEvaluation scores (per category → dimension mapping)
 * - SecurityBoundaryResult (boosts/penalizes security dimension)
 * - Healthcheck result (task_execution)
 * - Network activity compliance (compliance dimension)
 * - Resource metrics (engineering dimension)
 */
export function computeDimensionalScores(result: LocalAuditResult): DimensionalScores {
  const evaluations = (result.answerEvaluations ?? []) as AnswerEvaluation[];
  const boundary = result.securityBoundaryScore as SecurityBoundaryResult | undefined;

  // Group evaluation scores by dimension
  const dimensionScores: Record<AuditDimension, number[]> = {
    security: [],
    task_execution: [],
    cognitive: [],
    environment: [],
    engineering: [],
    compliance: []
  };

  for (const evaluation of evaluations) {
    const dimension = CATEGORY_DIMENSION_MAP[evaluation.category];
    if (dimension) {
      dimensionScores[dimension].push(evaluation.score);
    }
    // All evaluations contribute to cognitive (answer quality)
    dimensionScores.cognitive.push(evaluation.score);
  }

  // Security: include boundary score
  if (boundary) {
    dimensionScores.security.push(boundary.score);
  }

  // Task execution: healthcheck
  dimensionScores.task_execution.push(result.healthcheckPassed ? 100 : 0);

  // Engineering: resource usage signals
  const resourceScore = computeResourceScore(result.cpuAvgMilli, result.memoryPeakMb);
  dimensionScores.engineering.push(resourceScore);

  // Compliance: network policy adherence
  const complianceScore = computeNetworkComplianceScore(result);
  dimensionScores.compliance.push(complianceScore);

  // Compute per-dimension averages
  const dimensions: Record<AuditDimension, number> = {
    security: 50,
    task_execution: 50,
    cognitive: 50,
    environment: 50,
    engineering: 50,
    compliance: 50
  };

  for (const dim of ALL_DIMENSIONS) {
    const scores = dimensionScores[dim];
    if (scores.length > 0) {
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      dimensions[dim] = Math.round(avg);
    }
  }

  // Overall: weighted average
  const overallScore = Math.round(
    ALL_DIMENSIONS.reduce(
      (sum, dim) => sum + dimensions[dim] * DIMENSION_WEIGHTS[dim],
      0
    )
  );

  return { dimensions, overallScore };
}

function computeResourceScore(cpuAvgMilli: number, memoryPeakMb: number): number {
  // Score based on reasonable resource usage thresholds
  let cpuScore = 100;
  if (cpuAvgMilli > 500) cpuScore = 80;
  if (cpuAvgMilli > 1000) cpuScore = 60;
  if (cpuAvgMilli > 2000) cpuScore = 30;

  let memScore = 100;
  if (memoryPeakMb > 256) memScore = 80;
  if (memoryPeakMb > 512) memScore = 60;
  if (memoryPeakMb > 1024) memScore = 30;

  return Math.round((cpuScore + memScore) / 2);
}

function computeNetworkComplianceScore(result: LocalAuditResult): number {
  // If no network activity, perfect compliance
  if (result.requestCount === 0) return 100;

  const reconciliation = result.actionReconciliation;
  if (!reconciliation) return 80;

  const hasUndeclared = reconciliation.undeclaredObservedHosts.length > 0;
  const reasonCode = result.reasonCode;

  if (reasonCode === "UNDECLARED_EGRESS" || hasUndeclared) return 10;
  if (reasonCode === "ACTION_MISMATCH") return 40;

  return 90;
}
