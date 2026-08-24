import type {
  AuditRequestedEvent,
  ListenerAuditExecutionRetryItem,
  ProcessedAuditRequested
} from "./types";

/**
 * 队列内容的持久化所有权属于实现该接口的状态层；本模块只编排状态转换。默认文件存储以
 * eventKey 做 upsert/remove，并由 listener 服务锁保证单进程写入。本接口本身不提供锁、租约或
 * 跨进程事务，因此替换存储实现时必须继续保证同一 eventKey 的覆盖语义和单消费者约束。
 */
export interface AuditExecutionRetryStateStore {
  readAuditExecutionRetryQueue(): Promise<ListenerAuditExecutionRetryItem[]>;
  upsertAuditExecutionRetry(item: ListenerAuditExecutionRetryItem): Promise<void>;
  removeAuditExecutionRetry(eventKey: string): Promise<void>;
}

export interface RetryAuditExecutionResult {
  eventKey: string;
  outcome: "completed" | "retry-scheduled";
  tokenId: string;
  processed?: ProcessedAuditRequested;
  attemptCount?: number;
  nextAttemptAt?: string;
  reasonCode?: string;
  error?: string;
}

export interface FlushAuditExecutionRetryQueueOptions {
  state: AuditExecutionRetryStateStore;
  processAuditRequested: (event: AuditRequestedEvent) => Promise<ProcessedAuditRequested>;
  now?: () => Date;
}

// 仅基础设施/依赖暂态故障进入执行重试。业务审计失败不在此白名单中，避免把一个已经得到
// 确定结论的审计重复执行；新增 reasonCode 时必须同时评估重复执行的成本与副作用。
export const RETRYABLE_REASON_CODES = [
  "DOCKER_UNAVAILABLE",
  "IMAGE_PULL_FAILED",
  "CONTAINER_START_FAILED",
  "AGENT_UNAVAILABLE",
  "REQUEST_TIMEOUT",
  "REPORT_STORAGE_FAILED"
] as const;

export type RetryableAuditExecutionReasonCode = (typeof RETRYABLE_REASON_CODES)[number];

const RETRYABLE_REASON_CODE_SET = new Set<RetryableAuditExecutionReasonCode>(RETRYABLE_REASON_CODES);

// attemptCount 包含最初那次失败。退避在第四次及以后封顶为五分钟且没有最大次数，队列项会
// 持续保留直至得到非可重试结果；运行方应通过队列观测发现永久性依赖故障。
function getRetryBackoffMs(attemptCount: number): number {
  if (attemptCount <= 1) {
    return 10_000;
  }

  if (attemptCount === 2) {
    return 30_000;
  }

  if (attemptCount === 3) {
    return 60_000;
  }

  return 300_000;
}

function buildRetryErrorMessage(reasonCode: string): string {
  return `retryable audit execution failure: ${reasonCode}`;
}

function toAuditRequestedEvent(item: ListenerAuditExecutionRetryItem): AuditRequestedEvent {
  // bigint 无法直接写入 JSON，持久化模型使用十进制字符串；反序列化失败会显式抛错，不能把
  // 损坏的 tokenId 静默转换成另一个链上主体。
  return {
    eventKey: item.eventKey,
    tokenId: BigInt(item.tokenId),
    developer: item.developer,
    agentName: item.agentName,
    manifestUrl: item.manifestUrl,
    blockNumber: item.blockNumber,
    transactionHash: item.transactionHash
  };
}

function isDue(item: ListenerAuditExecutionRetryItem, now: Date): boolean {
  return Date.parse(item.nextAttemptAt) <= now.getTime();
}

export function isRetryableAuditExecutionFailure(processed: ProcessedAuditRequested): boolean {
  return (
    processed.auditResult.status === "failed" &&
    typeof processed.auditResult.reasonCode === "string" &&
    RETRYABLE_REASON_CODE_SET.has(processed.auditResult.reasonCode as RetryableAuditExecutionReasonCode)
  );
}

/**
 * 原始审计已经执行过一次，因此新项从 attemptCount=1 开始。事件的链上定位字段被完整复制，
 * 使进程重启后可以用同一个 eventKey 重建请求；队列只保存重放所需数据，不接管报告等产物的
 * 持久化所有权。
 */
export function createAuditExecutionRetryItem(
  processed: ProcessedAuditRequested,
  now: Date = new Date()
): ListenerAuditExecutionRetryItem {
  const reasonCode = processed.auditResult.reasonCode;
  if (!reasonCode) {
    throw new Error("retryable audit execution failures require a reasonCode");
  }

  return {
    eventKey: processed.event.eventKey,
    tokenId: processed.event.tokenId.toString(),
    developer: processed.event.developer,
    agentName: processed.event.agentName,
    manifestUrl: processed.event.manifestUrl,
    blockNumber: processed.event.blockNumber,
    transactionHash: processed.event.transactionHash,
    attemptCount: 1,
    lastAttemptAt: now.toISOString(),
    nextAttemptAt: new Date(now.getTime() + getRetryBackoffMs(1)).toISOString(),
    lastReasonCode: reasonCode,
    lastError: buildRetryErrorMessage(reasonCode)
  };
}

export async function flushAuditExecutionRetryQueue(
  options: FlushAuditExecutionRetryQueueOptions
): Promise<RetryAuditExecutionResult[]> {
  const now = options.now ?? (() => new Date());
  const queuedItems = await options.state.readAuditExecutionRetryQueue();
  const results: RetryAuditExecutionResult[] = [];

  // 每轮读取一次快照并串行处理到期项，避免同一进程内并发运行多个容器审计。nextAttemptAt 被
  // 视为可信的 ISO 时间；非法时间会得到 NaN 并保持未到期，状态层/运维迁移必须维护该格式。
  for (const item of queuedItems) {
    const nowValue = now();
    if (!isDue(item, nowValue)) {
      continue;
    }

    // 重试绕过内存 deduper，但沿用原 eventKey，确保报告路径和后续队列仍可按同一事件归并。
    // 这里刻意不捕获抛出的异常：异常会中止本轮 flush，原项尚未删除且仍可在下轮重试；只有
    // 返回结构化的 retryable failed 结果才会推进 attemptCount 与退避时间。
    const processed = await options.processAuditRequested(toAuditRequestedEvent(item));

    if (!isRetryableAuditExecutionFailure(processed)) {
      // 执行阶段一旦得到最终结果就先删除执行重试项，再把 processed 交还 CLI 进入写回阶段。
      // 写回若失败由独立写回队列接管，避免同一审计因链上提交故障而重新跑容器。
      await options.state.removeAuditExecutionRetry(item.eventKey);
      results.push({
        eventKey: item.eventKey,
        outcome: "completed",
        tokenId: item.tokenId,
        processed
      });
      continue;
    }

    const reasonCode = processed.auditResult.reasonCode as string;
    const nextAttemptCount = item.attemptCount + 1;
    const nextAttemptAt = new Date(
      nowValue.getTime() + getRetryBackoffMs(nextAttemptCount)
    ).toISOString();
    const scheduledItem: ListenerAuditExecutionRetryItem = {
      ...item,
      attemptCount: nextAttemptCount,
      lastAttemptAt: nowValue.toISOString(),
      nextAttemptAt,
      lastReasonCode: reasonCode,
      lastError: buildRetryErrorMessage(reasonCode)
    };
    // 先持久化新调度再报告结果；upsert 失败会向上抛出并保留旧队列状态，不会虚报已安排重试。
    await options.state.upsertAuditExecutionRetry(scheduledItem);
    results.push({
      eventKey: item.eventKey,
      outcome: "retry-scheduled",
      tokenId: item.tokenId,
      attemptCount: scheduledItem.attemptCount,
      nextAttemptAt: scheduledItem.nextAttemptAt,
      reasonCode,
      error: scheduledItem.lastError
    });
  }

  return results;
}
