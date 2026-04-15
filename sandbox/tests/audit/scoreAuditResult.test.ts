import test from "node:test";
import assert from "node:assert/strict";

import { scoreAuditResult } from "../../src/audit/scoreAuditResult";
import type { LocalAuditResult } from "../../src/types/manifest";

function buildLocalAuditResult(
  overrides: Partial<LocalAuditResult> = {}
): LocalAuditResult {
  return {
    agentName: "risk-agent",
    manifestHash: "a".repeat(64),
    healthcheckPassed: true,
    answer: "safe result",
    actions: [{ type: "web_request", url: "https://api.risk.com/v1/alert" }],
    decisionType: "undetermined",
    cpuAvgMilli: 120,
    memoryPeakMb: 256,
    requestedIps: ["203.0.113.10"],
    requestedHosts: ["api.risk.com"],
    requestCount: 1,
    status: "completed",
    startedAt: "2026-03-28T10:00:00.000Z",
    finishedAt: "2026-03-28T10:00:05.000Z",
    ...overrides
  };
}

test("scoreAuditResult returns 100 and Passed for a completed result without a reasonCode", () => {
  const scored = scoreAuditResult(buildLocalAuditResult());

  assert.deepEqual(scored, {
    auditScore: 100,
    status: "Passed"
  });
});

test("scoreAuditResult returns 0 and Failed for a failed result with a reasonCode", () => {
  const scored = scoreAuditResult(
    buildLocalAuditResult({
      status: "failed",
      reasonCode: "REQUEST_TIMEOUT"
    })
  );

  assert.deepEqual(scored, {
    auditScore: 0,
    status: "Failed",
    reasonCode: "REQUEST_TIMEOUT"
  });
});

test("scoreAuditResult treats a completed result with a reasonCode as failed", () => {
  const scored = scoreAuditResult(
    buildLocalAuditResult({
      status: "completed",
      reasonCode: "ACTION_MISMATCH"
    })
  );

  assert.deepEqual(scored, {
    auditScore: 0,
    status: "Failed",
    reasonCode: "ACTION_MISMATCH"
  });
});
