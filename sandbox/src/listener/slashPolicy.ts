import type { ProcessedAuditRequested, SlashReasonCode } from "./types";

const SLASH_REASON_PRIORITY: readonly SlashReasonCode[] = [
  "UNDECLARED_EGRESS",
  "ACTION_MISMATCH"
];

function collectSlashReasons(
  processed: Pick<ProcessedAuditRequested, "auditResult">
): Set<SlashReasonCode> {
  const reasons = new Set<SlashReasonCode>();
  const primaryReason = processed.auditResult.reasonCode;
  const reconciliationReason = processed.auditResult.actionReconciliation?.reasonCode;

  if (primaryReason === "UNDECLARED_EGRESS" || primaryReason === "ACTION_MISMATCH") {
    reasons.add(primaryReason);
  }

  if (reconciliationReason === "ACTION_MISMATCH") {
    reasons.add(reconciliationReason);
  }

  return reasons;
}

export function selectSlashReasonCode(
  processed: Pick<ProcessedAuditRequested, "auditResult">
): SlashReasonCode | undefined {
  const reasons = collectSlashReasons(processed);

  for (const reason of SLASH_REASON_PRIORITY) {
    if (reasons.has(reason)) {
      return reason;
    }
  }

  return undefined;
}

export type SlashDecisionOutcome = "slash" | "none";

export interface SlashDecision {
  outcome: SlashDecisionOutcome;
  reasonCode?: SlashReasonCode;
}

export function evaluateSlashDecision(
  processed: Pick<ProcessedAuditRequested, "auditResult" | "writeback">
): SlashDecision {
  if (processed.writeback.status === "Passed") {
    return { outcome: "none" };
  }

  const reasonCode = selectSlashReasonCode(processed);
  if (reasonCode !== undefined) {
    return { outcome: "slash", reasonCode };
  }

  return { outcome: "none" };
}
