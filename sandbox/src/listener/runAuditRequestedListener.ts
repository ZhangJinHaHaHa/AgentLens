import type { InMemoryEventDeduper } from "./inMemoryEventDeduper";
import type { SlashDecision } from "./slashPolicy";
import type { AuditRequestedEvent, ProcessedAuditRequested, SlashReasonCode } from "./types";

/**
 * 生命周期事件是 listener 与日志/任务状态投影之间的可观测性契约，不是业务状态的权威来源。
 * 每个载荷沿用链上 eventKey 便于跨阶段关联；emit 回调会被 await，故持久化型观察器失败也会
 * 中断当前批次，调用方不得把“日志已发出”当作链上写回已经完成。
 */
export type ListenerTaskLifecycleEvent =
  | {
      type: "listener-task-received" | "listener-task-started" | "listener-task-duplicate-skipped";
      eventKey: string;
      tokenId: string;
      agentName: string;
      manifestUrl: string;
      blockNumber: number;
      transactionHash: string;
    }
  | {
      type: "listener-task-processed";
      eventKey: string;
      tokenId: string;
      agentName: string;
      manifestUrl: string;
      blockNumber: number;
      transactionHash: string;
      auditStatus: ProcessedAuditRequested["writeback"]["status"];
      auditScore: number;
      reasonCode: string | null;
    }
  | {
      type: "listener-task-slashed";
      eventKey: string;
      tokenId: string;
      agentName: string;
      manifestUrl: string;
      blockNumber: number;
      transactionHash: string;
      slashReasonCode: SlashReasonCode;
    }
  | {
      type: "listener-task-slash-failed";
      eventKey: string;
      tokenId: string;
      agentName: string;
      manifestUrl: string;
      blockNumber: number;
      transactionHash: string;
      slashReasonCode: SlashReasonCode;
      error: string;
    }
  | {
      type: "listener-task-failed";
      eventKey: string;
      tokenId: string;
      agentName: string;
      manifestUrl: string;
      blockNumber: number;
      transactionHash: string;
      error: string;
    };

interface ListenerTaskEventBase {
  eventKey: string;
  tokenId: string;
  agentName: string;
  manifestUrl: string;
  blockNumber: number;
  transactionHash: string;
}

export interface PostWritebackSlashRequest {
  processed: ProcessedAuditRequested;
  decision: SlashDecision;
}

export interface RunAuditRequestedListenerOnceResult {
  processed: ProcessedAuditRequested[];
  latestBlockNumber: number;
  nextBlock: number;
}

export interface RunAuditRequestedListenerDependencies {
  // deduper 只拥有当前 runtime 生命周期内的认领状态；游标、重试队列和报告由外层分别持久化。
  deduper: InMemoryEventDeduper;
  getLatestBlockNumber: () => Promise<number>;
  pollAuditRequestedLogs: (options: {
    fromBlock: number;
    toBlock: number;
  }) => Promise<AuditRequestedEvent[]>;
  processAuditRequested: (event: AuditRequestedEvent) => Promise<ProcessedAuditRequested>;
  writeAuditResult?: (processed: ProcessedAuditRequested) => Promise<unknown>;
  evaluateSlashDecision?: (processed: ProcessedAuditRequested) => SlashDecision;
  handlePostWritebackSlash?: (request: PostWritebackSlashRequest) => Promise<void>;
  // 该回调处在控制流内而非 best-effort 旁路；除斩罚分支的显式隔离外，拒绝会按调用位置传播。
  emitLifecycleEvent?: (event: ListenerTaskLifecycleEvent) => void | Promise<void>;
}

function buildEventBase(event: AuditRequestedEvent): ListenerTaskEventBase {
  return {
    eventKey: event.eventKey,
    tokenId: event.tokenId.toString(),
    agentName: event.agentName,
    manifestUrl: event.manifestUrl,
    blockNumber: event.blockNumber,
    transactionHash: event.transactionHash
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

export async function runAuditRequestedListenerOnce(
  options: {
    fromBlock: number;
  } & RunAuditRequestedListenerDependencies
): Promise<RunAuditRequestedListenerOnceResult> {
  // 一次调用只负责 fromBlock 到本次观测链头的闭区间。它不写游标；CLI 仅在本函数成功返回后
  // 持久化 nextBlock，从而让进程崩溃时可以重新轮询尚未提交游标的区间。
  const latestBlockNumber = await options.getLatestBlockNumber();

  if (latestBlockNumber < options.fromBlock) {
    // 节点落后或调用方游标领先时保持原游标，绝不倒退，否则已处理区间会被无条件重放。
    return {
      processed: [],
      latestBlockNumber,
      nextBlock: options.fromBlock
    };
  }

  const events = await options.pollAuditRequestedLogs({
    fromBlock: options.fromBlock,
    toBlock: latestBlockNumber
  });
  const processed: ProcessedAuditRequested[] = [];

  // 保持 RPC 返回顺序串行处理，使本地资源使用和写回顺序可预测；本层不排序、不等待确认数，
  // 区块最终性与重组回放策略由调用方选择的 RPC/起始游标负责。
  for (const event of events) {
    const eventBase = buildEventBase(event);
    await options.emitLifecycleEvent?.({
      type: "listener-task-received",
      ...eventBase
    });

    if (!options.deduper.claim(event.eventKey)) {
      await options.emitLifecycleEvent?.({
        type: "listener-task-duplicate-skipped",
        ...eventBase
      });
      continue;
    }

    // claim 发生在任何审计副作用之前。同一进程内重复的 txHash:logIndex 会被跳过；认领不会在
    // 失败时释放，因此抛错路径依靠“游标未保存 + 进程重启后新 deduper”恢复，而非本轮内重入。
    await options.emitLifecycleEvent?.({
      type: "listener-task-started",
      ...eventBase
    });

    let handled: ProcessedAuditRequested;
    try {
      handled = await options.processAuditRequested(event);
    } catch (error) {
      // 未结构化为 ProcessedAuditRequested 的异常表示执行边界没有产出可持久化结果：先记录失败
      // 再原样抛出，阻止外层推进区块游标。emit 自身失败时也会传播，不会伪装成审计失败。
      await options.emitLifecycleEvent?.({
        type: "listener-task-failed",
        ...eventBase,
        error: toErrorMessage(error)
      });
      throw error;
    }

    await options.emitLifecycleEvent?.({
      type: "listener-task-processed",
      ...eventBase,
      auditStatus: handled.writeback.status,
      auditScore: handled.writeback.auditScore,
      reasonCode: handled.auditResult.reasonCode ?? null
    });

    processed.push(handled);

    if (options.writeAuditResult) {
      // 写回是可选兼容能力：只读部署仍返回审计产物。此处不自行捕获错误；生产 CLI 的观察包装器
      // 会把可恢复的执行/写回故障持久化到各自队列，其他依赖实现则保留失败即停批次的语义。
      await options.writeAuditResult(handled);
    }

    // 只有两个能力同时存在才启用 post-writeback 斩罚扩展点，避免配置不完整时发生资金操作。
    // 决策为 slash 时 reasonCode 必须存在，这是 SlashDecision 的跨模块约定。
    if (options.evaluateSlashDecision && options.handlePostWritebackSlash) {
      const decision = options.evaluateSlashDecision(handled);
      if (decision.outcome === "slash") {
        try {
          await options.handlePostWritebackSlash({ processed: handled, decision });
          await options.emitLifecycleEvent?.({
            type: "listener-task-slashed",
            ...eventBase,
            slashReasonCode: decision.reasonCode!
          });
        } catch (slashError) {
          // try 同时覆盖斩罚处理器和 slashed 成功事件，因此 slash-failed 也可能表示成功事件落库
          // 失败；两种情况都不回滚已确认审计。本函数不创建耐久重试项，需由处理器/外层队列承担。
          // 若 slash-failed 事件本身也发送失败，该错误仍会向上传播并阻止批次成功返回。
          await options.emitLifecycleEvent?.({
            type: "listener-task-slash-failed",
            ...eventBase,
            slashReasonCode: decision.reasonCode!,
            error: toErrorMessage(slashError)
          });
        }
      }
    }
  }

  return {
    processed,
    latestBlockNumber,
    // 轮询区间已完整成功处理后才越过本次链头；该独占游标约定必须与持久化 cursor.nextBlock
    // 和下一轮 fromBlock 保持一致。
    nextBlock: latestBlockNumber + 1
  };
}
