import type {
  AuditDecisionClassification,
  AuditDecisionFacts
} from "../types/manifest";
import { parseAuditAnswer } from "./parseAuditAnswer";

const REDLINE_REASON_CODES = new Set([
  "UNDECLARED_EGRESS",
  "ACTION_MISMATCH"
]);

export function classifyAuditDecision(
  facts: AuditDecisionFacts
): AuditDecisionClassification {
  if (facts.reasonCode && REDLINE_REASON_CODES.has(facts.reasonCode)) {
    return { decisionType: "redline_violation" };
  }

  if (facts.answer) {
    const parsed = parseAuditAnswer(facts.answer);

    if (parsed.decisionType) {
      return { decisionType: parsed.decisionType };
    }
  }

  if (facts.status === "completed" && !facts.reasonCode) {
    return { decisionType: "undetermined" };
  }

  return { decisionType: "ordinary_failure" };
}
