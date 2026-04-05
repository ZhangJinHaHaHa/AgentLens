import type { AuditDecisionClassification } from "../types/manifest";

const DECISION_PATTERN =
  /(^|\n)\s*decision\s*:\s*(undetermined|ordinary_failure|redline_violation)\b/i;

export interface ParsedAuditAnswerDecision {
  decisionType?: AuditDecisionClassification["decisionType"];
}

export function parseAuditAnswer(answer: string): ParsedAuditAnswerDecision {
  const match = answer.match(DECISION_PATTERN);

  if (!match) {
    return {};
  }

  return {
    decisionType: match[2].toLowerCase() as AuditDecisionClassification["decisionType"]
  };
}
