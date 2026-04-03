import type {
  AppealCompensationExecutor,
  AppealCompensationResult
} from "./appealCompensation";
import type { AppealChainWriter } from "./appealChainWriter";
import type { AppealReviewRecord } from "./appealReviewTypes";
import { assertValidTransition } from "./appealReviewTypes";

export interface AppealReviewHandlerStore {
  findById(appealId: string): Promise<AppealReviewRecord | undefined>;
  update(
    appealId: string,
    fields: Partial<AppealReviewRecord>
  ): Promise<AppealReviewRecord>;
}

export interface AppealReviewHandlerDependencies {
  readonly store: AppealReviewHandlerStore;
  readonly now?: () => Date;
  readonly compensateAppeal?: AppealCompensationExecutor;
  readonly compensationAmount?: string;
  readonly compensationReasonCode?: string;
  readonly appealChainWriter?: AppealChainWriter;
}

export interface AppealReviewHandler {
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
    throw new Error(`Appeal not found: ${appealId}`);
  }

  return record;
}

export function createAppealReviewHandler(
  deps: AppealReviewHandlerDependencies
): AppealReviewHandler {
  const now = deps.now ?? (() => new Date());

  return {
    async startReview(
      appealId: string,
      reviewerAddress: string
    ): Promise<AppealReviewRecord> {
      const record = await loadRecord(deps.store, appealId);
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
      assertValidTransition(record.status, "approved");

      let compensationTxHash: string | undefined;

      if (deps.compensateAppeal) {
        const result: AppealCompensationResult =
          await deps.compensateAppeal({
            tokenId: record.tokenId,
            auditId: record.eventKey,
            amount: deps.compensationAmount ?? "0",
            reasonCode: deps.compensationReasonCode ?? "APPEAL_APPROVED"
          });
        compensationTxHash = result.transactionHash;
      }

      // Write appeal resolution to chain (V2)
      if (deps.appealChainWriter) {
        try {
          await deps.appealChainWriter.resolveAppealOnChain({
            tokenId: record.tokenId,
            appealId,
            outcome: "approved"
          });
        } catch (err) {
          // Non-fatal: log but proceed with off-chain update
          console.error("[appealReviewHandler] resolveAppealOnChain (approved) failed:", err);
        }
      }

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
      assertValidTransition(record.status, "rejected");

      // Write appeal resolution to chain (V2)
      if (deps.appealChainWriter) {
        try {
          await deps.appealChainWriter.resolveAppealOnChain({
            tokenId: record.tokenId,
            appealId,
            outcome: "rejected"
          });
        } catch (err) {
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
