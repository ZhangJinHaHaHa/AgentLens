import { createHash } from "node:crypto";

import type {
  AuditAction,
  AuditActionReconciliation,
  AuditDecisionClassification,
  AuditQuestionMeta,
  AnswerEvaluationMeta,
  SecurityBoundaryMeta,
  LocalAuditResult,
  NetworkEvidence
} from "../types/manifest";

/**
 * 对外持久化的审计报告协议，而不是运行期结果对象的别名。
 *
 * `schemaVersion` 由本模块依据实际写入的字段决定：没有逐答案评估时继续产出 v1，
 * 从而让旧消费者不必认识 v2 字段；一旦包含 `answerEvaluations` 则升级为 v2。
 * 可选字段必须保持“无数据即省略”的语义，因为字段是否存在、字段顺序和缩进都会进入
 * 最终 JSON 字节并影响内容哈希，不能把 `undefined`、空数组和缺失字段随意互换。
 */
export interface DetailedAuditReport {
  schemaVersion: "audit-report.v1" | "audit-report.v2";
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
  answerEvaluations?: AnswerEvaluationMeta[];
  securityBoundaryScore?: SecurityBoundaryMeta;
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

/**
 * 哈希覆盖准备持久化的完整 JSON 字符串（Node 默认按 UTF-8 编码），用于把文件名、
 * 远端对象键与确切报告字节绑定。它只提供内容完整性标识，不承担签名或来源认证；
 * 验证方必须对读取到的原始字节使用同一算法，而不能解析后重新序列化再比较。
 */
export function computeAuditReportHash(reportJson: string): string {
  return createHash("sha256").update(reportJson).digest("hex");
}

/**
 * 将一次已经完成的本地审计结果冻结为下游共享的报告快照。
 * 本函数不执行 I/O，也不拥有重试状态；调用方应把返回的 `reportJson` 与 `reportHash`
 * 视为同一不可拆分制品，后续持久化和上传不得再从可变的 `report` 对象重建字节。
 */
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
  // v2 的判定绑定“至少有一条评估”这一既有兼容规则；空数组仍生成 v1 且不写该字段。
  const hasEvaluations = result.answerEvaluations && result.answerEvaluations.length > 0;
  const schemaVersion = hasEvaluations ? "audit-report.v2" : "audit-report.v1";

  const report: DetailedAuditReport = {
    schemaVersion,
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
    ...(hasEvaluations ? { answerEvaluations: result.answerEvaluations } : {}),
    ...(result.securityBoundaryScore ? { securityBoundaryScore: result.securityBoundaryScore } : {}),
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
  // 这里是规范字节的唯一生成点；两空格缩进和对象构造顺序都是当前哈希协议的一部分。
  const reportJson = JSON.stringify(report, null, 2);

  return {
    report,
    reportJson,
    reportHash: computeAuditReportHash(reportJson)
  };
}
