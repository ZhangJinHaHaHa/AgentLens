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
