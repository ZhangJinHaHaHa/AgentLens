import type { AppConfig } from "@/config/appConfig";
import type { AuditRecord } from "@/lib/agentAuditRegistryClient";
import type { DetailedAuditReport } from "@/lib/auditReportClient";
import {
  AUDIT_STATUS_COMPENSATED,
  AUDIT_STATUS_FAILED,
  AUDIT_STATUS_PASSED,
  AUDIT_STATUS_PENDING,
  AUDIT_STATUS_SLASHED
} from "@/lib/auditStatus";
import { isAttestationPresent } from "@/lib/chainEvidence";
import type { I18nText } from "./i18nText";

export type AuditSummaryVerdict =
  | "passed"
  | "failed"
  | "pending"
  | "slashed"
  | "compensated"
  | "unknown";

export type AuditSummarySeverity = "success" | "warning" | "danger" | "neutral";
export type AuditHashStatus = "verified" | "unavailable" | "mismatch";

export interface AuditReportSummary {
  verdict: AuditSummaryVerdict;
  severity: AuditSummarySeverity;
  score: number | null;
  hashStatus: AuditHashStatus;
  primaryRisk: I18nText;
  safetyBoundary: I18nText;
  nextStep: I18nText;
  badges: string[];
}

interface SummarizeAuditReportInput {
  auditRecord: AuditRecord;
  report: DetailedAuditReport | null;
  hashVerified: boolean;
  reportUnavailableMessage?: string | null;
  attestationConfig?: AppConfig["attestation"];
}

export function summarizeAuditReport({
  auditRecord,
  report,
  hashVerified,
  reportUnavailableMessage,
  attestationConfig
}: SummarizeAuditReportInput): AuditReportSummary {
  const hashStatus: AuditHashStatus = hashVerified
    ? "verified"
    : report || !reportUnavailableMessage
      ? "mismatch"
      : "unavailable";
  const verdict = getVerdict(auditRecord, report);
  const severity = getSeverity(verdict, hashStatus);
  const score = getScore(auditRecord, report);
  const badges = [
    hashStatus === "verified" ? "hash-verified" : hashStatus === "mismatch" ? "hash-mismatch" : "hash-unavailable",
    isAttestationPresent(auditRecord.attestationHash) ? "tee-present" : "tee-missing",
    attestationConfig?.verifyReportDataBinding ? "tee-report-bound" : null
  ].filter((item): item is string => item !== null);

  return {
    verdict,
    severity,
    score,
    hashStatus,
    primaryRisk: getPrimaryRisk(verdict, hashStatus, report),
    safetyBoundary: getSafetyBoundary(report?.securityBoundaryScore),
    nextStep: getNextStep(verdict, hashStatus),
    badges
  };
}

function getVerdict(auditRecord: AuditRecord, report: DetailedAuditReport | null): AuditSummaryVerdict {
  switch (Number(auditRecord.status)) {
    case AUDIT_STATUS_PENDING:
      return "pending";
    case AUDIT_STATUS_PASSED:
      return "passed";
    case AUDIT_STATUS_FAILED:
      return "failed";
    case AUDIT_STATUS_SLASHED:
      return "slashed";
    case AUDIT_STATUS_COMPENSATED:
      return "compensated";
    default:
      break;
  }

  const decision = report?.decisionType.toLowerCase() ?? "";
  if (decision.includes("pass")) return "passed";
  if (decision.includes("fail")) return "failed";
  return "unknown";
}

function getSeverity(verdict: AuditSummaryVerdict, hashStatus: AuditHashStatus): AuditSummarySeverity {
  if (hashStatus === "mismatch") return "danger";
  if (verdict === "failed" || verdict === "slashed") return "danger";
  if (verdict === "pending" || hashStatus === "unavailable") return "warning";
  if (verdict === "passed" || verdict === "compensated") return "success";
  return "neutral";
}

function getScore(auditRecord: AuditRecord, report: DetailedAuditReport | null): number | null {
  if (report?.dimensionalScores) return report.dimensionalScores.overallScore;
  const score = Number(auditRecord.auditScore);
  return Number.isFinite(score) ? score : null;
}

function getPrimaryRisk(
  verdict: AuditSummaryVerdict,
  hashStatus: AuditHashStatus,
  report: DetailedAuditReport | null
): I18nText {
  if (hashStatus === "mismatch") {
    return {
      zh: "详细报告哈希与链上记录不一致，不能把这份报告当作可信证据。",
      en: "Detailed report hash does not match the on-chain record; do not treat this report as trusted evidence."
    };
  }

  const flags = report?.securityBoundaryScore?.flags ?? [];
  if (flags.length > 0) {
    return {
      zh: `主要风险：${flags.slice(0, 3).join(", ")}`,
      en: `Primary risk: ${flags.slice(0, 3).join(", ")}`
    };
  }

  if (verdict === "failed" || verdict === "slashed") {
    const reason = report?.reasonCode ?? report?.decisionType ?? "failed audit";
    return {
      zh: `审计未通过：${reason}`,
      en: `Audit did not pass: ${reason}`
    };
  }

  if (verdict === "pending") {
    return {
      zh: "审计尚未完成；不要基于这条记录做租赁或正式接入决策。",
      en: "Audit is still pending; do not use this record for rental or production decisions."
    };
  }

  return {
    zh: "未发现重大风险；仍应先在低权限、小范围环境里试用。",
    en: "No major risk found; still start in a low-privilege, limited trial."
  };
}

function getSafetyBoundary(boundary: DetailedAuditReport["securityBoundaryScore"]): I18nText {
  if (!boundary) {
    return {
      zh: "没有详细安全边界评分；只能参考链上摘要。",
      en: "No detailed security boundary score is available; rely only on the on-chain summary."
    };
  }

  if (!boundary.hasAuthBoundary || !boundary.privilegeEscalationResistant) {
    return {
      zh: `安全边界偏弱，评分 ${boundary.score}。正式接入前需要额外隔离。`,
      en: `Security boundary is weak, score ${boundary.score}. Add isolation before formal use.`
    };
  }

  return {
    zh: `安全边界通过，评分 ${boundary.score}。`,
    en: `Security boundary passed, score ${boundary.score}.`
  };
}

function getNextStep(verdict: AuditSummaryVerdict, hashStatus: AuditHashStatus): I18nText {
  if (hashStatus === "mismatch") {
    return {
      zh: "先停止使用这份报告，重新拉取报告或要求重新审计。",
      en: "Stop relying on this report; fetch it again or request a new audit."
    };
  }

  if (verdict === "failed" || verdict === "slashed") {
    return {
      zh: "不要租赁；先看失败原因与申诉状态。",
      en: "Do not rent; inspect the failure reason and appeal status first."
    };
  }

  if (verdict === "pending") {
    return {
      zh: "等待审计完成后再决策。",
      en: "Wait for the audit to finish before deciding."
    };
  }

  return {
    zh: "从低权限、小流量试用开始，再决定是否正式接入。",
    en: "Start with a low-privilege, limited trial before formal integration."
  };
}
