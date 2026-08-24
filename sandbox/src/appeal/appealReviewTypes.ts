// 这些字面量同时出现在 JSON 文件和审核 API 中，是持久化/wire 协议；新增或改名必须考虑旧记录与客户端兼容。
export type AppealReviewStatus = "pending" | "under_review" | "approved" | "rejected";

/**
 * AppealReviewRecord 是审核子系统的规范快照。readonly 只提供 TypeScript 编译期约束，
 * 运行时完整性仍依赖 store 的受控写入以及对磁盘 JSON 的信任。
 */
export interface AppealReviewRecord {
  // appealId 既是领域主键又被文件 store 用作文件名，进入持久化层前必须满足安全路径段约束。
  readonly appealId: string;
  // handler 当前会把 eventKey 作为补偿 auditId；启用真实补偿时该值必须兼容十进制解析，而不能是任意事件复合键。
  readonly eventKey: string;
  // tokenId 以十进制字符串保存，以便跨 JSON 边界保留 uint256 精度。
  readonly tokenId: string;
  readonly status: AppealReviewStatus;
  readonly reason: string;
  readonly reviewerAddress?: string;
  readonly reviewNote?: string;
  readonly createdAt: string;
  readonly reviewedAt?: string;
  readonly slashReasonCode: number;
  readonly originalAuditScore: number;
  // 哈希仅记录补偿执行器返回的关联标识，不在此证明交易成功、确认深度或最终性。
  readonly compensationTxHash?: string;
}

// 创建输入故意不接受 status、审核人或时间戳；store 负责赋予 pending 和 createdAt，防止调用方伪造生命周期阶段。
export interface AppealReviewCreateInput {
  readonly appealId: string;
  readonly eventKey: string;
  readonly tokenId: string;
  readonly reason: string;
  readonly slashReasonCode: number;
  readonly originalAuditScore: number;
}

// 状态机策略在本文件集中定义，但文件 store 的通用 update 不会自动调用它；业务写入应通过 AppealReviewHandler。
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
  // 不允许自迁移使终态不可重复提交，也意味着命令级重试不是幂等成功；超时恢复应先读取当前状态。
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
    // AppealReviewApi 依据该固定前缀识别迁移错误；改变文案需同步调整 HTTP 错误分类。
    throw new Error(
      `Invalid status transition: cannot move from "${from}" to "${to}".`
    );
  }
}
