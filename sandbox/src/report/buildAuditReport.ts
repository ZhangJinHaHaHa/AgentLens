import { createHash } from "node:crypto";

import type {
  AuditAction,
  AuditActionReconciliation,
  AuditDecisionClassification,
  AuditQuestionMeta,
  LocalAuditResult,
  NetworkEvidence
} from "../types/manifest";

export interface DetailedAuditReport {
  schemaVersion: "audit-report.v1";
  agentName: string;
  manifestHash: string;
  status: string;
  decisionType: AuditDecisionClassification["decisionType"];
  reasonCode?: string;
  healthcheckPassed: boolean;
  resourceMetrics: {
    cpuAvgMilli: number;
    memoryPeakMb: number;
  };
  networkActivity: {
    requestedIps: string[];
    requestedHosts: string[];
    requestCount: number;
  };
  networkEvidence?: NetworkEvidence;
  auditQuestions?: AuditQuestionMeta[];
  responseTrace: {
    answer: string;
    actions: AuditAction[];
    reconciliation?: AuditActionReconciliation;
  };
  timestamps: {
    startedAt: string;
    finishedAt: string;
  };
  evidence?: {
    evidenceRoot: string;
    eventCount: number;
    evidenceCid?: string;
    attestationHash?: string;
  };
}

export interface AuditReportArtifact {
  report: DetailedAuditReport;
  reportJson: string;
  reportHash: string;
}

export function computeAuditReportHash(reportJson: string): string {
  return createHash("sha256").update(reportJson).digest("hex");
}

export function buildAuditReport(
  result: LocalAuditResult,
  options: {
    evidence?: {
      evidenceRoot: string;
      eventCount: number;
      evidenceCid?: string;
      attestationHash?: string;
    };
  } = {}
): AuditReportArtifact {
  const report: DetailedAuditReport = {
    schemaVersion: "audit-report.v1",
    agentName: result.agentName,
    manifestHash: result.manifestHash,
    status: result.status,
    decisionType: result.decisionType,
    ...(result.reasonCode ? { reasonCode: result.reasonCode } : {}),
    healthcheckPassed: result.healthcheckPassed,
    resourceMetrics: {
      cpuAvgMilli: result.cpuAvgMilli,
      memoryPeakMb: result.memoryPeakMb
    },
    networkActivity: {
      requestedIps: result.requestedIps,
      requestedHosts: result.requestedHosts,
      requestCount: result.requestCount
    },
    ...(result.networkEvidence ? { networkEvidence: result.networkEvidence } : {}),
    ...(result.questions?.length ? { auditQuestions: result.questions } : {}),
    responseTrace: {
      answer: result.answer,
      actions: result.actions,
      ...(result.actionReconciliation
        ? { reconciliation: result.actionReconciliation }
        : {})
    },
    timestamps: {
      startedAt: result.startedAt,
      finishedAt: result.finishedAt
    },
    ...(options.evidence ? { evidence: options.evidence } : {})
  };
  const reportJson = JSON.stringify(report, null, 2);

  return {
    report,
    reportJson,
    reportHash: computeAuditReportHash(reportJson)
  };
}
