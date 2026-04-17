import test from "node:test";
import assert from "node:assert/strict";

import { selectSlashReasonCode, evaluateSlashDecision } from "../../src/listener/slashPolicy";
import type { ProcessedAuditRequested, AuditWritebackSummary } from "../../src/listener/types";
import type { LocalAuditResult } from "../../src/types/manifest";

function buildAuditResult(overrides: Partial<LocalAuditResult> = {}): LocalAuditResult {
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
    startedAt: "2026-03-23T10:00:00.000Z",
    finishedAt: "2026-03-23T10:00:05.000Z",
    ...overrides
  };
}

function buildProcessed(
  auditResult: LocalAuditResult = buildAuditResult()
): Pick<ProcessedAuditRequested, "auditResult"> {
  return { auditResult };
}

test("selectSlashReasonCode returns UNDECLARED_EGRESS for slash-eligible network egress violations", () => {
  const selected = selectSlashReasonCode(
    buildProcessed(
      buildAuditResult({
        status: "failed",
        reasonCode: "UNDECLARED_EGRESS",
        decisionType: "redline_violation",
        answer: "",
        actions: []
      })
    )
  );

  assert.equal(selected, "UNDECLARED_EGRESS");
});

test("selectSlashReasonCode returns ACTION_MISMATCH for slash-eligible reconciliation failures", () => {
  const selected = selectSlashReasonCode(
    buildProcessed(
      buildAuditResult({
        status: "failed",
        reasonCode: "ACTION_MISMATCH",
        decisionType: "redline_violation",
        answer: "",
        actions: [],
        actionReconciliation: {
          declaredHosts: ["api.risk.com"],
          observedHosts: ["evil.example"],
          undeclaredObservedHosts: ["evil.example"],
          declaredUnobservedHosts: [],
          reasonCode: "ACTION_MISMATCH"
        }
      })
    )
  );

  assert.equal(selected, "ACTION_MISMATCH");
});

test("selectSlashReasonCode prioritizes UNDECLARED_EGRESS when multiple hard-signal facts are present", () => {
  const selected = selectSlashReasonCode(
    buildProcessed(
      buildAuditResult({
        status: "failed",
        reasonCode: "UNDECLARED_EGRESS",
        decisionType: "redline_violation",
        answer: "",
        actions: [],
        actionReconciliation: {
          declaredHosts: ["api.risk.com"],
          observedHosts: ["evil.example"],
          undeclaredObservedHosts: ["evil.example"],
          declaredUnobservedHosts: [],
          reasonCode: "ACTION_MISMATCH"
        }
      })
    )
  );

  assert.equal(selected, "UNDECLARED_EGRESS");
});

test("selectSlashReasonCode does not infer slash eligibility from decisionType alone", () => {
  const selected = selectSlashReasonCode(
    buildProcessed(
      buildAuditResult({
        decisionType: "redline_violation",
        reasonCode: undefined
      })
    )
  );

  assert.equal(selected, undefined);
});

test("selectSlashReasonCode returns undefined when no slash-eligible reason is present", () => {
  const selected = selectSlashReasonCode(
    buildProcessed(
      buildAuditResult({
        status: "failed",
        reasonCode: "REQUEST_TIMEOUT",
        decisionType: "ordinary_failure",
        answer: "",
        actions: []
      })
    )
  );

  assert.equal(selected, undefined);
});

function buildWriteback(
  overrides: Partial<AuditWritebackSummary> = {}
): AuditWritebackSummary {
  return {
    tokenId: 1n,
    auditScore: 100,
    memoryPeakMb: 256,
    cpuAvgMilli: 120,
    requestIpCount: 1,
    status: "Passed",
    manifestHash: "a".repeat(64),
    reportHash: "b".repeat(64),
    reportCID: "",
    manifestUrl: "https://example.com/manifest.json",
    ...overrides
  };
}

function buildProcessedWithWriteback(
  auditResult: LocalAuditResult = buildAuditResult(),
  writeback: AuditWritebackSummary = buildWriteback()
): Pick<ProcessedAuditRequested, "auditResult" | "writeback"> {
  return { auditResult, writeback };
}

test("evaluateSlashDecision returns none for a passing audit", () => {
  const decision = evaluateSlashDecision(
    buildProcessedWithWriteback(
      buildAuditResult({
        status: "completed"
      }),
      buildWriteback({ status: "Passed", auditScore: 100 })
    )
  );

  assert.deepEqual(decision, { outcome: "none" });
});

test("evaluateSlashDecision returns slash with UNDECLARED_EGRESS for a failed audit with egress violation", () => {
  const decision = evaluateSlashDecision(
    buildProcessedWithWriteback(
      buildAuditResult({
        status: "failed",
        reasonCode: "UNDECLARED_EGRESS",
        decisionType: "redline_violation",
        answer: "",
        actions: []
      }),
      buildWriteback({ status: "Failed", auditScore: 0 })
    )
  );

  assert.deepEqual(decision, { outcome: "slash", reasonCode: "UNDECLARED_EGRESS" });
});

test("evaluateSlashDecision returns slash with ACTION_MISMATCH for a failed audit with action mismatch", () => {
  const decision = evaluateSlashDecision(
    buildProcessedWithWriteback(
      buildAuditResult({
        status: "failed",
        reasonCode: "ACTION_MISMATCH",
        decisionType: "redline_violation",
        answer: "",
        actions: []
      }),
      buildWriteback({ status: "Failed", auditScore: 0 })
    )
  );

  assert.deepEqual(decision, { outcome: "slash", reasonCode: "ACTION_MISMATCH" });
});

test("evaluateSlashDecision returns none for a failed audit with non-slash-eligible reason", () => {
  const decision = evaluateSlashDecision(
    buildProcessedWithWriteback(
      buildAuditResult({
        status: "failed",
        reasonCode: "REQUEST_TIMEOUT",
        decisionType: "ordinary_failure",
        answer: "",
        actions: []
      }),
      buildWriteback({ status: "Failed", auditScore: 0 })
    )
  );

  assert.deepEqual(decision, { outcome: "none" });
});
