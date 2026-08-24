import type {
  AppealCompensationExecutor,
  AppealCompensationResult
} from "./appealCompensation";
import type { AppealChainWriter } from "./appealChainWriter";
import type { AppealReviewRecord } from "./appealReviewTypes";
import { assertValidTransition } from "./appealReviewTypes";

/**
 * handler 负责状态机与副作用顺序，store 负责记录所有权和持久化。
 * 由于接口是 find-then-update 而非带版本号的 compare-and-set，本层不能防止两个审核者同时通过同一旧状态检查。
 */
export interface AppealReviewHandlerStore {
  findById(appealId: string): Promise<AppealReviewRecord | undefined>;
  update(
    appealId: string,
    fields: Partial<AppealReviewRecord>
  ): Promise<AppealReviewRecord>;
}

export interface AppealReviewHandlerDependencies {
  readonly store: AppealReviewHandlerStore;
  // 注入时钟只用于终态 reviewedAt，避免测试或重放流程依赖墙上时钟。
  readonly now?: () => Date;
  readonly compensateAppeal?: AppealCompensationExecutor;
  readonly compensationAmount?: string;
  readonly compensationReasonCode?: string;
  readonly appealChainWriter?: AppealChainWriter;
}

export interface AppealReviewHandler {
  // 状态命令不是幂等 upsert：相同命令成功后再次执行会因不允许自迁移而失败。
  startReview(
    appealId: string,
    reviewerAddress: string
  ): Promise<AppealReviewRecord>;

  approveAppeal(
    appealId: string,
    reviewerAddress: string,
    note: string
  ): Promise<AppealReviewRecord>;

  rejectAppeal(
    appealId: string,
    reviewerAddress: string,
    note: string
  ): Promise<AppealReviewRecord>;
}

async function loadRecord(
  store: AppealReviewHandlerStore,
  appealId: string
): Promise<AppealReviewRecord> {
  const record = await store.findById(appealId);
  if (!record) {
    // AppealReviewApi 通过此前缀映射 404；在引入结构化领域错误前，该文案属于跨模块兼容契约。
    throw new Error(`Appeal not found: ${appealId}`);
  }

  return record;
}

export function createAppealReviewHandler(
  deps: AppealReviewHandlerDependencies
): AppealReviewHandler {
  // now 在构造时绑定，确保同一 handler 的时间来源不会在流程中途切换。
  const now = deps.now ?? (() => new Date());

  return {
    async startReview(
      appealId: string,
      reviewerAddress: string
    ): Promise<AppealReviewRecord> {
      const record = await loadRecord(deps.store, appealId);
      // 先验证领域迁移再写入；但读取与更新之间没有锁，store 的并发实现决定是否可能发生丢失更新。
      assertValidTransition(record.status, "under_review");

      return deps.store.update(appealId, {
        status: "under_review",
        reviewerAddress
      });
    },

    async approveAppeal(
      appealId: string,
      reviewerAddress: string,
      note: string
    ): Promise<AppealReviewRecord> {
      const record = await loadRecord(deps.store, appealId);
      // 只有 under_review 能进入批准路径，格式或迁移错误会在任何链上副作用之前终止。
      assertValidTransition(record.status, "approved");

      let compensationTxHash: string | undefined;

      if (deps.compensateAppeal) {
        // 当前映射把 eventKey 直接作为 auditId；真实补偿执行器只接受十进制字符串，通用事件键必须在接入时先建立兼容映射。
        // 未配置金额时仍会显式发送 "0"，reasonCode 则使用稳定默认值；这两项默认语义须与合约版本保持一致。
        const result: AppealCompensationResult =
          await deps.compensateAppeal({
            tokenId: record.tokenId,
            auditId: record.eventKey,
            amount: deps.compensationAmount ?? "0",
            reasonCode: deps.compensationReasonCode ?? "APPEAL_APPROVED"
          });
        compensationTxHash = result.transactionHash;
      }

      // 补偿失败是致命错误，不会继续解析申诉；补偿成功后才尝试 V2 决议写入，因此二者并非原子交易。
      // Write appeal resolution to chain (V2)
      if (deps.appealChainWriter) {
        try {
          // writer 要求十进制 appealId；若记录使用 apl-* 等内部标识，编码会失败并按下方非致命策略处理。
          await deps.appealChainWriter.resolveAppealOnChain({
            tokenId: record.tokenId,
            appealId,
            outcome: "approved"
          });
        } catch (err) {
          // 链同步失败只写日志，且成功交易哈希也未保存；本地 approved 状态因此不能证明链上决议已经完成。
          // Non-fatal: log but proceed with off-chain update
          console.error("[appealReviewHandler] resolveAppealOnChain (approved) failed:", err);
        }
      }

      // 本地终态最后落盘。若此前链副作用成功而 update 失败，记录仍可能是 under_review；盲目重试会重复补偿/决议。
      return deps.store.update(appealId, {
        status: "approved",
        reviewerAddress,
        reviewNote: note,
        reviewedAt: now().toISOString(),
        ...(compensationTxHash ? { compensationTxHash } : {})
      });
    },

    async rejectAppeal(
      appealId: string,
      reviewerAddress: string,
      note: string
    ): Promise<AppealReviewRecord> {
      const record = await loadRecord(deps.store, appealId);
      // rejected 是终态；校验与 update 分离，仍需依赖 store 或外层串行化来避免并发终态互相覆盖。
      assertValidTransition(record.status, "rejected");

      // 拒绝路径没有资金补偿，但链写依旧早于本地终态，二者可能在故障时短暂或永久分叉。
      // Write appeal resolution to chain (V2)
      if (deps.appealChainWriter) {
        try {
          await deps.appealChainWriter.resolveAppealOnChain({
            tokenId: record.tokenId,
            appealId,
            outcome: "rejected"
          });
        } catch (err) {
          // 与批准路径相同，链错误不阻止本地拒绝；运维恢复不能通过本地状态推断链上是否需要重试。
          // Non-fatal: log but proceed with off-chain update
          console.error("[appealReviewHandler] resolveAppealOnChain (rejected) failed:", err);
        }
      }

      return deps.store.update(appealId, {
        status: "rejected",
        reviewerAddress,
        reviewNote: note,
        reviewedAt: now().toISOString()
      });
    }
  };
}
