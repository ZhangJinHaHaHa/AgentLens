import type { AuditReportByIndex } from "./readAuditReportByIndex";
import type { ListenerSlashRetryItem, SlashReasonCode } from "./types";
import type { WriteSlashBondRequest } from "./writeSlashBond";

/**
 * 状态存储拥有斩罚重试项的耐久性，本协调器只读取快照并按 eventKey 更新或删除。默认 JSON
 * 实现依赖 listener 的服务锁维持单写者；自定义实现若允许多个 worker，必须额外提供领取/租约，
 * 否则两个 flush 可能同时通过链上预检并重复提交具有资金影响的交易。
 */
export interface SlashRetryStateStore {
  readSlashRetryQueue(): Promise<ListenerSlashRetryItem[]>;
  upsertSlashRetry(item: ListenerSlashRetryItem): Promise<void>;
  removeSlashRetry(eventKey: string): Promise<void>;
}

export interface RetrySlashResult {
  eventKey: string;
  outcome: "reconciled" | "confirmed" | "retry-scheduled";
  tokenId: string;
  auditId: number;
  transactionHash?: `0x${string}`;
  blockNumber?: number;
  attemptCount?: number;
  nextAttemptAt?: string;
  error?: string;
}

export interface CreateSlashRetryItemOptions {
  eventKey: string;
  tokenId: bigint;
  auditId: number;
  slashAmount: bigint;
  reasonCode: SlashReasonCode;
}

export interface FlushSlashRetryQueueOptions {
  state: SlashRetryStateStore;
  readAuditReportByIndex: (tokenId: bigint, index: number) => Promise<AuditReportByIndex>;
  submitSlashBond: (
    request: WriteSlashBondRequest
  ) => Promise<{ transactionHash: `0x${string}`; blockNumber?: number }>;
  now?: () => Date;
}

// 与 AgentAuditRegistry.AuditStatus 的枚举序号绑定：Pending=0、Passed=1、Failed=2、Slashed=3。
// 合约若调整枚举顺序，必须同步升级该兼容常量，否则幂等核对会失效。
const SLASHED_AUDIT_STATUS = 3;

// 首三次逐级退避，之后固定五分钟；当前策略不自动转 terminal，也不设置最大尝试次数。
// 持续失败项由持久化队列保留，避免一次 RPC/签名节点故障导致资金操作被遗忘。
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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

function isDue(item: ListenerSlashRetryItem, now: Date): boolean {
  return item.state === "pending" && Date.parse(item.nextAttemptAt) <= now.getTime();
}

export function createSlashRetryItem(
  options: CreateSlashRetryItemOptions,
  error: unknown,
  now: Date = new Date()
): ListenerSlashRetryItem {
  // tokenId 与 amount 使用十进制字符串保存，以绕开 JSON 对 bigint 的限制并避免 number 精度损失。
  // attemptCount=1 表示调用方已经历首次提交失败，本函数安排的是下一次尝试。
  return {
    eventKey: options.eventKey,
    state: "pending",
    tokenId: options.tokenId.toString(),
    auditId: options.auditId,
    slashAmount: options.slashAmount.toString(),
    reasonCode: options.reasonCode,
    attemptCount: 1,
    lastAttemptAt: now.toISOString(),
    nextAttemptAt: new Date(now.getTime() + getRetryBackoffMs(1)).toISOString(),
    lastError: toErrorMessage(error)
  };
}

export async function flushSlashRetryQueue(
  options: FlushSlashRetryQueueOptions
): Promise<RetrySlashResult[]> {
  const now = options.now ?? (() => new Date());
  const queuedItems = await options.state.readSlashRetryQueue();
  const results: RetrySlashResult[] = [];

  // terminal 项及尚未到期的 pending 项不会被触碰。时间戳来自持久化边界；格式损坏会使
  // Date.parse 返回 NaN，从而令项目保持未到期，状态迁移必须保证 ISO-8601 可解析性。
  for (const item of queuedItems) {
    const nowValue = now();
    if (!isDue(item, nowValue)) {
      continue;
    }

    // tokenId 在 try 之前恢复；若持久化值不是合法十进制整数，BigInt 会中止整轮 flush 且原项
    // 保持不变。这把身份字段损坏视为需要修复的队列数据错误，而不是可自动重试的链上故障。
    const tokenId = BigInt(item.tokenId);
    // 合约的 auditId 为从 1 开始的业务标识，而 getAuditReportByIndex 接收零基数组下标。
    // 该换算是与当前 AgentAuditRegistry 存储布局绑定的兼容约束。
    const index = item.auditId - 1;

    try {
      // 先读取目标审计而非 latest：提交成功但回执丢失时，status=Slashed 可把重放收敛为删除队列。
      // 这是 read-before-write 的幂等防护，不是链上原子操作；RPC 滞后或并发消费者仍需由单写者
      // 约束和合约端状态规则共同防护。
      const record = await options.readAuditReportByIndex(tokenId, index);
      if (record.status === SLASHED_AUDIT_STATUS) {
        await options.state.removeSlashRetry(item.eventKey);
        results.push({
          eventKey: item.eventKey,
          outcome: "reconciled",
          tokenId: item.tokenId,
          auditId: item.auditId
        });
        continue;
      }

      const receipt = await options.submitSlashBond({
        tokenId,
        auditId: item.auditId,
        amount: BigInt(item.slashAmount),
        reasonCode: item.reasonCode
      });
      // 仅在提交方返回确认回执后删除耐久项。若交易成功而 remove 失败，catch 会重新调度；
      // 下一轮应通过上面的链上状态核对完成清理，而不是依赖本地“已发送”标志。
      await options.state.removeSlashRetry(item.eventKey);
      results.push({
        eventKey: item.eventKey,
        outcome: "confirmed",
        tokenId: item.tokenId,
        auditId: item.auditId,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      });
    } catch (error) {
      // 链上读取、amount 恢复、交易提交及队列删除的失败均保留项目。没有错误分类或永久失败上限，
      // 因而合约权限/参数等确定性错误也会继续退避，必须结合 lastError 做运维处置。
      const nextAttemptCount = item.attemptCount + 1;
      const nextAttemptAt = new Date(
        nowValue.getTime() + getRetryBackoffMs(nextAttemptCount)
      ).toISOString();
      const scheduledItem: ListenerSlashRetryItem = {
        ...item,
        attemptCount: nextAttemptCount,
        lastAttemptAt: nowValue.toISOString(),
        nextAttemptAt,
        lastError: toErrorMessage(error)
      };
      // upsert 是“已安排下一次尝试”的提交点；若持久化失败则向上抛错，旧项仍是恢复依据。
      await options.state.upsertSlashRetry(scheduledItem);
      results.push({
        eventKey: item.eventKey,
        outcome: "retry-scheduled",
        tokenId: item.tokenId,
        auditId: item.auditId,
        attemptCount: scheduledItem.attemptCount,
        nextAttemptAt: scheduledItem.nextAttemptAt,
        error: scheduledItem.lastError
      });
    }
  }

  return results;
}
