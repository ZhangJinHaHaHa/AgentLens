import {
  buildAuditEvidenceEvent,
  type AuditEvidenceEvent,
  type AuditEvidenceStage,
  ZERO_EVIDENCE_HASH
} from "./buildAuditEvidenceEvent";

export interface AuditEvidenceChainContext {
  // 一个 context 归属于一次审计事件的单一执行流；events 与 evidenceRoot 是同步更新的可变状态。
  eventKey: string;
  tokenId: string;
  events: AuditEvidenceEvent[];
  evidenceRoot: string;
}

export interface AuditEvidenceInput {
  stage: AuditEvidenceStage;
  timestamp?: string;
  payload: unknown;
}

export function createAuditEvidenceChainContext(input: {
  eventKey: string;
  tokenId: bigint | string;
}): AuditEvidenceChainContext {
  return {
    eventKey: input.eventKey,
    // bigint/string 在边界统一为十进制文本，避免 JSON 持久化不支持 bigint，并稳定跨运行时表示。
    tokenId: input.tokenId.toString(),
    events: [],
    evidenceRoot: ZERO_EVIDENCE_HASH
  };
}

export function appendAuditEvidenceEvent(
  context: AuditEvidenceChainContext,
  input: AuditEvidenceInput
): AuditEvidenceEvent {
  /**
   * sequence 由当前数组长度派生，prevHash 指向当前尾事件，因此调用顺序就是证据顺序。
   * context 不提供并发锁或去重：同一阶段重复调用会追加新事件，重试方必须复用既定时间戳并自行判断
   * 是否已经追加，不能把本函数当作幂等写入接口。
   */
  const event = buildAuditEvidenceEvent({
    eventKey: context.eventKey,
    tokenId: context.tokenId,
    sequence: context.events.length + 1,
    stage: input.stage,
    timestamp: input.timestamp ?? new Date().toISOString(),
    prevHash: context.events.at(-1)?.eventHash ?? ZERO_EVIDENCE_HASH,
    payload: input.payload
  });

  // 先完整构建事件再改变 context；哈希计算失败时不会留下半追加状态。成功后持久化责任仍在上层。
  context.events.push(event);
  context.evidenceRoot = event.eventHash;

  return event;
}
