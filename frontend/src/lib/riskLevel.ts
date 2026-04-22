export type RiskLevel = "low" | "moderate" | "elevated" | "high" | "critical";

export interface RiskClassification {
  level: RiskLevel;
  label: string;
  cssClass: string;
}

export function classifyRisk(reputationScore: number): RiskClassification {
  if (reputationScore >= 8000) {
    return { level: "low", label: "Low Risk", cssClass: "risk-badge--low" };
  }
  if (reputationScore >= 5000) {
    return { level: "moderate", label: "Moderate Risk", cssClass: "risk-badge--moderate" };
  }
  if (reputationScore >= 2000) {
    return { level: "elevated", label: "Elevated Risk", cssClass: "risk-badge--elevated" };
  }
  if (reputationScore >= 500) {
    return { level: "high", label: "High Risk", cssClass: "risk-badge--high" };
  }
  return { level: "critical", label: "Critical Risk", cssClass: "risk-badge--critical" };
}

export interface AuditFreshness {
  label: string;
  cssClass: string;
}

const SEVEN_DAYS = 7 * 24 * 60 * 60;
const THIRTY_DAYS = 30 * 24 * 60 * 60;
const NINETY_DAYS = 90 * 24 * 60 * 60;

export function getAuditFreshness(lastAuditAtUnix: number): AuditFreshness {
  if (lastAuditAtUnix <= 0) {
    return { label: "No audits", cssClass: "freshness-badge--stale" };
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const age = nowUnix - lastAuditAtUnix;

  if (age < SEVEN_DAYS) {
    return { label: "Fresh", cssClass: "freshness-badge--fresh" };
  }
  if (age < THIRTY_DAYS) {
    return { label: "Recent", cssClass: "freshness-badge--recent" };
  }
  if (age < NINETY_DAYS) {
    return { label: "Aging", cssClass: "freshness-badge--aging" };
  }
  return { label: "Stale", cssClass: "freshness-badge--stale" };
}
