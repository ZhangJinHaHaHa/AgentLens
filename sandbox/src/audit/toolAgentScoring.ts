import type { LocalAuditResult } from "../types/manifest";
import type { AnswerEvaluation } from "./evaluateAuditAnswer";

/** Additional dimensions for tool-type agents. */
export type ToolAgentDimension =
  | "api_reliability"
  | "data_accuracy"
  | "latency"
  | "error_recovery";

export const ALL_TOOL_DIMENSIONS: readonly ToolAgentDimension[] = [
  "api_reliability",
  "data_accuracy",
  "latency",
  "error_recovery"
];

export interface ToolAgentScores {
  isToolAgent: boolean;
  dimensions: Record<ToolAgentDimension, number>;
}

/**
 * Detect if an agent is a tool-type agent based on manifest signals.
 * Tool agents have external API endpoints in their allowed hosts.
 */
export function isToolAgent(
  allowedHosts: readonly string[],
  allowedRpcEndpoints: readonly string[]
): boolean {
  return allowedHosts.length > 0 || allowedRpcEndpoints.length > 0;
}

/**
 * Compute additional tool-agent dimensions from audit result.
 */
export function computeToolAgentScores(
  result: LocalAuditResult,
  allowedHosts: readonly string[],
  allowedRpcEndpoints: readonly string[]
): ToolAgentScores {
  if (!isToolAgent(allowedHosts, allowedRpcEndpoints)) {
    return {
      isToolAgent: false,
      dimensions: {
        api_reliability: 0,
        data_accuracy: 0,
        latency: 0,
        error_recovery: 0
      }
    };
  }

  const evaluations = (result.answerEvaluations ?? []) as AnswerEvaluation[];

  // API reliability: based on healthcheck + whether all declared hosts responded
  const healthBonus = result.healthcheckPassed ? 50 : 0;
  const reconciliation = result.actionReconciliation;
  const declaredObservedRatio = reconciliation
    ? reconciliation.declaredUnobservedHosts.length === 0 ? 50 : 25
    : 30;
  const apiReliability = Math.min(100, healthBonus + declaredObservedRatio);

  // Data accuracy: from functionality evaluations
  const funcEvals = evaluations.filter((e) => e.category === "functionality");
  const dataAccuracy = funcEvals.length > 0
    ? Math.round(funcEvals.reduce((sum, e) => sum + e.score, 0) / funcEvals.length)
    : 50;

  // Latency: inverse of resource usage
  const latency = result.cpuAvgMilli <= 200 ? 95
    : result.cpuAvgMilli <= 500 ? 80
    : result.cpuAvgMilli <= 1000 ? 60
    : 30;

  // Error recovery: from robustness evaluations
  const robustnessEvals = evaluations.filter((e) => e.category === "robustness");
  const errorRecovery = robustnessEvals.length > 0
    ? Math.round(robustnessEvals.reduce((sum, e) => sum + e.score, 0) / robustnessEvals.length)
    : 50;

  return {
    isToolAgent: true,
    dimensions: {
      api_reliability: apiReliability,
      data_accuracy: dataAccuracy,
      latency,
      error_recovery: errorRecovery
    }
  };
}
