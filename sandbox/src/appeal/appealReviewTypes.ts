export type AppealReviewStatus = "pending" | "under_review" | "approved" | "rejected";

export interface AppealReviewRecord {
  readonly appealId: string;
  readonly eventKey: string;
  readonly tokenId: string;
  readonly status: AppealReviewStatus;
  readonly reason: string;
  readonly reviewerAddress?: string;
  readonly reviewNote?: string;
  readonly createdAt: string;
  readonly reviewedAt?: string;
  readonly slashReasonCode: number;
  readonly originalAuditScore: number;
  readonly compensationTxHash?: string;
}

export interface AppealReviewCreateInput {
  readonly appealId: string;
  readonly eventKey: string;
  readonly tokenId: string;
  readonly reason: string;
  readonly slashReasonCode: number;
  readonly originalAuditScore: number;
}

/**
 * Validates that a status transition is legal.
 * Legal transitions:
 *   pending -> under_review
 *   under_review -> approved
 *   under_review -> rejected
 */
export function isValidTransition(
  from: AppealReviewStatus,
  to: AppealReviewStatus
): boolean {
  if (from === "pending" && to === "under_review") {
    return true;
  }

  if (from === "under_review" && (to === "approved" || to === "rejected")) {
    return true;
  }

  return false;
}

export function assertValidTransition(
  from: AppealReviewStatus,
  to: AppealReviewStatus
): void {
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid status transition: cannot move from "${from}" to "${to}".`
    );
  }
}
