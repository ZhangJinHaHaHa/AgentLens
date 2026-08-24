import type { ListenerRetryQueueItem, ProcessedAuditRequested } from "./types";
import type { LatestAuditReport } from "./readLatestAuditReport";
import { ZERO_EVIDENCE_HASH } from "../evidence/buildAuditEvidenceEvent";

/**
 * 写回队列的状态所有权位于注入的持久化层。pending 项可被调度，terminal 项作为冲突证据保留但
 * 不再自动执行；upsert 必须按 eventKey 覆盖，remove 必须幂等。默认文件实现依靠 listener
 * 服务锁串行写入，本接口本身并不提供多消费者领取或事务隔离。
 */
export interface RetryQueueStateStore {
  readRetryQueue(): Promise<ListenerRetryQueueItem[]>;
  upsertRetry(item: ListenerRetryQueueItem): Promise<void>;
  removeRetry(eventKey: string): Promise<void>;
}

export interface RetryWritebackReceipt {
  transactionHash: `0x${string}`;
  blockNumber?: number;
}

export interface RetryWritebackResult {
  eventKey: string;
  outcome: "reconciled" | "confirmed" | "conflict" | "retry-scheduled";
  tokenId: string;
  transactionHash?: `0x${string}`;
  blockNumber?: number;
  attemptCount?: number;
  nextAttemptAt?: string;
  state?: ListenerRetryQueueItem["state"];
  error?: string;
}

export interface FlushRetryWritebackQueueOptions {
  state: RetryQueueStateStore;
  readLatestAuditReport: (tokenId: bigint) => Promise<LatestAuditReport>;
  submitWriteback: (item: ListenerRetryQueueItem) => Promise<RetryWritebackReceipt>;
  now?: () => Date;
}

// attemptCount 记录包含首次失败在内的累计尝试。第四次起退避封顶五分钟且没有自动放弃阈值；
// 只有链上核对成功、确认回执或显式冲突会结束 pending 的循环。
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

function normalizeBytes32(value: string): `0x${string}` {
  // 持久化前只统一 0x 前缀，不在这里校验长度或十六进制字符；真正的 bytes32 校验由后续 ABI
  // 编码边界执行。这样兼容内部无前缀哈希，同时不在队列层复制合约编码规则。
  if (value.startsWith("0x")) {
    return value as `0x${string}`;
  }

  return `0x${value}`;
}

function toExpectedStatus(status: ListenerRetryQueueItem["writeback"]["status"]): number {
  // 与 AgentAuditRegistry.AuditStatus 的稳定序号绑定：Passed=1、Failed=2；0 专用于 Pending。
  return status === "Passed" ? 1 : 2;
}

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function isReconciled(item: ListenerRetryQueueItem, latest: LatestAuditReport): boolean {
  // 回执超时并不等于交易失败，因此重发前必须按所有已持久化的链上字段核对。哈希忽略大小写；
  // 默认 ABI 读取总会返回 bytes32，双方未启用扩展时以零哈希对账。时间戳、auditId、申诉标志和
  // 维度分不属于该基础写回载荷，不能作为本队列的相等条件。
  return (
    latest.status === toExpectedStatus(item.writeback.status) &&
    latest.auditScore === item.writeback.auditScore &&
    latest.memoryPeakMb === item.writeback.memoryPeakMb &&
    latest.cpuAvgMilli === item.writeback.cpuAvgMilli &&
    latest.requestIpCount === item.writeback.requestIpCount &&
    sameHex(latest.manifestHash, item.writeback.manifestHash) &&
    sameHex(latest.reportHash, item.writeback.reportHash) &&
    sameHex(latest.evidenceRoot ?? ZERO_EVIDENCE_HASH, item.writeback.evidenceRoot ?? `0x${ZERO_EVIDENCE_HASH}`) &&
    sameHex(
      latest.attestationHash ?? ZERO_EVIDENCE_HASH,
      item.writeback.attestationHash ?? `0x${ZERO_EVIDENCE_HASH}`
    ) &&
    (latest.evidenceCID ?? "") === (item.writeback.evidenceCID ?? "") &&
    latest.reportCID === item.writeback.reportCID &&
    latest.manifestUrl === item.writeback.manifestUrl
  );
}

function isDue(item: ListenerRetryQueueItem, now: Date): boolean {
  return item.state === "pending" && Date.parse(item.nextAttemptAt) <= now.getTime();
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

export function createRetryQueueItem(
  processed: ProcessedAuditRequested,
  error: unknown,
  now: Date = new Date()
): ListenerRetryQueueItem {
  // 队列只复制恢复链上写入所需的稳定字段，不持久化完整报告、私钥或运行时对象。tokenId 转为
  // 十进制字符串以保持 bigint 精度；当前耐久 schema 不含 dimensionalScores，因此从该队列
  // 恢复时走基础 recordAuditResult 兼容路径，而不会重建 V2 维度分写入。
  return {
    eventKey: processed.event.eventKey,
    state: "pending",
    tokenId: processed.writeback.tokenId.toString(),
    writeback: {
      status: processed.writeback.status,
      auditScore: processed.writeback.auditScore,
      memoryPeakMb: processed.writeback.memoryPeakMb,
      cpuAvgMilli: processed.writeback.cpuAvgMilli,
      requestIpCount: processed.writeback.requestIpCount,
      manifestHash: normalizeBytes32(processed.writeback.manifestHash),
      reportHash: normalizeBytes32(processed.writeback.reportHash),
      evidenceRoot: normalizeBytes32(processed.writeback.evidenceRoot ?? ZERO_EVIDENCE_HASH),
      attestationHash: normalizeBytes32(processed.writeback.attestationHash ?? ZERO_EVIDENCE_HASH),
      evidenceCID: processed.writeback.evidenceCID ?? "",
      reportCID: processed.writeback.reportCID,
      manifestUrl: processed.writeback.manifestUrl
    },
    attemptCount: 1,
    lastAttemptAt: now.toISOString(),
    nextAttemptAt: new Date(now.getTime() + getRetryBackoffMs(1)).toISOString(),
    lastError: toErrorMessage(error)
  };
}

export async function flushRetryWritebackQueue(
  options: FlushRetryWritebackQueueOptions
): Promise<RetryWritebackResult[]> {
  const now = options.now ?? (() => new Date());
  const queuedItems = await options.state.readRetryQueue();
  const results: RetryWritebackResult[] = [];

  // 每轮对队列快照串行处理，只调度到期的 pending 项。nextAttemptAt 是持久化契约的一部分；
  // 非法日期会被视为未到期而留在队列中，迁移/人工修复不得破坏 ISO-8601 格式。
  for (const item of queuedItems) {
    const nowValue = now();
    if (!isDue(item, nowValue)) {
      continue;
    }

    // tokenId 在捕获交易错误前恢复。非法持久化值会中止整轮 flush、保留原项并暴露队列损坏，
    // 而不是被包装成一个可能无限循环的普通 RPC 重试。
    const tokenId = BigInt(item.tokenId);

    try {
      // latest 读取失败必须进入退避，不能将“不知道链上状态”降级成直接重发；这一步是应对
      // eth_sendRawTransaction/回执查询结果不确定时的幂等核对边界。
      const latest = await options.readLatestAuditReport(tokenId);

      if (isReconciled(item, latest)) {
        // 链上已经是预期值时只清理本地队列，不再提交第二笔交易。
        await options.state.removeRetry(item.eventKey);
        results.push({
          eventKey: item.eventKey,
          outcome: "reconciled",
          tokenId: item.tokenId
        });
        continue;
      }

      if (latest.status !== 0) {
        // 最新记录已离开 Pending 但字段不一致，说明另一个结果占有该链上状态。将项目保留为
        // terminal 可供人工审计，并阻止自动重试覆盖或错误关联到后续审计。
        const conflictError = "latest on-chain audit record conflicts with queued writeback";
        const terminalItem: ListenerRetryQueueItem = {
          ...item,
          state: "terminal",
          lastAttemptAt: nowValue.toISOString(),
          lastError: conflictError
        };
        await options.state.upsertRetry(terminalItem);
        results.push({
          eventKey: item.eventKey,
          outcome: "conflict",
          tokenId: item.tokenId,
          state: terminalItem.state,
          error: conflictError
        });
        continue;
      }

      const receipt = await options.submitWriteback(item);
      // 只有确认回执后才删除本地意图；若删除失败会落入 catch 重新调度，下一轮通过字段核对应
      // 收敛为 reconciled，从而覆盖“链上成功、本地提交点失败”的崩溃窗口。
      await options.state.removeRetry(item.eventKey);
      results.push({
        eventKey: item.eventKey,
        outcome: "confirmed",
        tokenId: item.tokenId,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      });
    } catch (error) {
      // RPC 读取、ABI/签名、交易确认和队列清理错误统一保留 pending 状态。此处不区分永久错误，
      // 也不吞掉 upsert 失败；lastError 与 attemptCount 是运维识别毒性项目的依据。
      const nextAttemptCount = item.attemptCount + 1;
      const nextAttemptAt = new Date(
        nowValue.getTime() + getRetryBackoffMs(nextAttemptCount)
      ).toISOString();
      const scheduledItem: ListenerRetryQueueItem = {
        ...item,
        attemptCount: nextAttemptCount,
        lastAttemptAt: nowValue.toISOString(),
        nextAttemptAt,
        lastError: toErrorMessage(error)
      };
      // 先耐久化新的重试时间再返回 retry-scheduled，避免观测事件领先于真实队列状态。
      await options.state.upsertRetry(scheduledItem);
      results.push({
        eventKey: item.eventKey,
        outcome: "retry-scheduled",
        tokenId: item.tokenId,
        attemptCount: scheduledItem.attemptCount,
        nextAttemptAt: scheduledItem.nextAttemptAt,
        error: scheduledItem.lastError
      });
    }
  }

  return results;
}
