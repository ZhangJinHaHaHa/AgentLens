/**
 * 固化合约审计状态码与界面标签/筛选语义：接受 bigint 或 number，输出稳定英文标签或是否命中四种筛选模式。
 * 该模块纯计算，无状态、缓存和网络副作用，也不负责拉取状态或重试；输入应来自已选择的正确合约版本。
 * 未知数值显示 `Unknown`，failed 筛选同时包含 Failed 与 Slashed，Compensated 仅在 all 中出现；这些分组是现有列表兼容契约。
 * `Number` 转换假设状态为小枚举，返回值只能用于展示过滤，不能据此在浏览器授予访问、退款或结算权限。
 */
export type AuditStatusCode = 0 | 1 | 2 | 3 | 4;

export const AUDIT_STATUS_PENDING = 0 as const;
export const AUDIT_STATUS_PASSED = 1 as const;
export const AUDIT_STATUS_FAILED = 2 as const;
export const AUDIT_STATUS_SLASHED = 3 as const;
export const AUDIT_STATUS_COMPENSATED = 4 as const;

export function getAuditStatusLabel(status: bigint | number): string {
  switch (Number(status)) {
    case AUDIT_STATUS_PENDING:
      return "Pending";
    case AUDIT_STATUS_PASSED:
      return "Passed";
    case AUDIT_STATUS_FAILED:
      return "Failed";
    case AUDIT_STATUS_SLASHED:
      return "Slashed";
    case AUDIT_STATUS_COMPENSATED:
      return "Compensated";
    default:
      return "Unknown";
  }
}

export type AuditStatusFilter = "all" | "passed" | "failed" | "pending";

export function matchesStatusFilter(
  status: bigint | number,
  filter: AuditStatusFilter
): boolean {
  if (filter === "all") {
    return true;
  }

  const numericStatus = Number(status);

  switch (filter) {
    case "passed":
      return numericStatus === AUDIT_STATUS_PASSED;
    case "failed":
      return (
        numericStatus === AUDIT_STATUS_FAILED || numericStatus === AUDIT_STATUS_SLASHED
      );
    case "pending":
      return numericStatus === AUDIT_STATUS_PENDING;
    default:
      return true;
  }
}
