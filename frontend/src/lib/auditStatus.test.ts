import { describe, expect, it } from "vitest";

import {
  getAuditStatusLabel,
  matchesStatusFilter,
  AUDIT_STATUS_PASSED,
  AUDIT_STATUS_FAILED,
  AUDIT_STATUS_SLASHED,
  AUDIT_STATUS_PENDING,
  AUDIT_STATUS_COMPENSATED
} from "./auditStatus";

describe("getAuditStatusLabel", () => {
  it("returns Pending for status 0", () => {
    expect(getAuditStatusLabel(0)).toBe("Pending");
    expect(getAuditStatusLabel(0n)).toBe("Pending");
  });

  it("returns Passed for status 1", () => {
    expect(getAuditStatusLabel(1)).toBe("Passed");
  });

  it("returns Failed for status 2", () => {
    expect(getAuditStatusLabel(2)).toBe("Failed");
  });

  it("returns Slashed for status 3", () => {
    expect(getAuditStatusLabel(3)).toBe("Slashed");
  });

  it("returns Compensated for status 4", () => {
    expect(getAuditStatusLabel(4)).toBe("Compensated");
  });

  it("returns Unknown for unrecognized status", () => {
    expect(getAuditStatusLabel(99)).toBe("Unknown");
  });
});

describe("matchesStatusFilter", () => {
  it("matches all statuses when filter is 'all'", () => {
    expect(matchesStatusFilter(AUDIT_STATUS_PASSED, "all")).toBe(true);
    expect(matchesStatusFilter(AUDIT_STATUS_FAILED, "all")).toBe(true);
    expect(matchesStatusFilter(AUDIT_STATUS_PENDING, "all")).toBe(true);
    expect(matchesStatusFilter(AUDIT_STATUS_SLASHED, "all")).toBe(true);
    expect(matchesStatusFilter(AUDIT_STATUS_COMPENSATED, "all")).toBe(true);
  });

  it("matches only passed status when filter is 'passed'", () => {
    expect(matchesStatusFilter(AUDIT_STATUS_PASSED, "passed")).toBe(true);
    expect(matchesStatusFilter(AUDIT_STATUS_FAILED, "passed")).toBe(false);
    expect(matchesStatusFilter(AUDIT_STATUS_PENDING, "passed")).toBe(false);
  });

  it("matches failed and slashed statuses when filter is 'failed'", () => {
    expect(matchesStatusFilter(AUDIT_STATUS_FAILED, "failed")).toBe(true);
    expect(matchesStatusFilter(AUDIT_STATUS_SLASHED, "failed")).toBe(true);
    expect(matchesStatusFilter(AUDIT_STATUS_PASSED, "failed")).toBe(false);
  });

  it("matches only pending status when filter is 'pending'", () => {
    expect(matchesStatusFilter(AUDIT_STATUS_PENDING, "pending")).toBe(true);
    expect(matchesStatusFilter(AUDIT_STATUS_PASSED, "pending")).toBe(false);
  });
});
