/**
 * 该文件将详细本地审计结果压缩为链路需要的保守二元摘要，并透传可选的评价与安全边界元数据。
 * 只有执行状态为 completed 且完全没有 reasonCode 才得到 100/Passed；任何失败事实都固定为 0/Failed，避免细分展示分掩盖硬失败。
 * 本层不重新计算 reasonCode、不校验证据，也不把 dimensional score 混入通过判定；它依赖上游已经完成执行和对账。
 * 0/100 与状态字符串属于报告/链上消费者的兼容契约，扩展字段必须继续保持可选以读取旧结果。
 * 函数只创建新摘要对象，不改变原始结果或持久化状态，因此没有回滚步骤。
 */
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
