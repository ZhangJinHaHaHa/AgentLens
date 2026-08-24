import type { ProcessedAuditRequested, SlashReasonCode } from "./types";

// 优先级是资金副作用的稳定业务约定：同一审计同时命中网络越界与行为不一致时，只提交一个
// bytes32 原因码，并固定选择 UNDECLARED_EGRESS，避免依赖 Set 插入顺序或上游检查顺序。
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

  // 斩罚名单有意小于 LocalAuditResult 的全部失败码。容器/RPC/存储等运行故障不能演变为资金
  // 处罚；ACTION_MISMATCH 既可能是主失败原因，也可能来自动作对账子结果。
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
  // 纯函数不读取或修改队列/链上状态，也不负责重试；相同审计结果必须产生确定的原因选择。
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
  // reasonCode 仅在 outcome=slash 时有值；调用资金写入边界前必须维持该成对不变量。
  outcome: SlashDecisionOutcome;
  reasonCode?: SlashReasonCode;
}

/**
 * 写回状态是最终门闩：Passed 即使携带异常 reasonCode 也绝不斩罚；Failed 只有命中明确白名单才
 * 返回 slash。未知或新增失败原因默认 none，使协议升级不会在未审查政策前自动扩大资金处罚面。
 * 本层仅作决策，不承诺 exactly-once；提交、链上核对和耐久重试由 listener 写入路径负责。
 */
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
