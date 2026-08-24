/**
 * 本解析器只从 agent 答案的独立行中提取约定的 DECISION 标记，供更高层分类政策参考。
 * 行首锚定、大小写不敏感和三值白名单共同避免普通叙述中偶然出现的单词被误判，同时保持旧 agent 输出的文本兼容性。
 * 没有合法标记时返回空对象而非猜测结果；红线 reasonCode、执行状态和动作证据仍由 `classifyAuditDecision` 决定优先级。
 * 此处不解析 JSON、不验证答案真实性，也不改变输入字符串或任何外部状态。
 * 解析是确定性内存操作，无法识别时由上层执行保守分类，不存在部分写入或回滚步骤。
 */
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
