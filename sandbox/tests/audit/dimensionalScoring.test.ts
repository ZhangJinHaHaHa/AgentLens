import test from "node:test";
import assert from "node:assert/strict";

import {
  computeDimensionalScores,
  ALL_DIMENSIONS,
  type AuditDimension
} from "../../src/audit/dimensionalScoring";
import type { LocalAuditResult } from "../../src/types/manifest";

function makeResult(overrides: Partial<LocalAuditResult> = {}): LocalAuditResult {
  return {
    agentName: "test-agent",
    manifestHash: "abc123",
    healthcheckPassed: true,
    answer: "test",
    actions: [],
    decisionType: "undetermined",
    cpuAvgMilli: 100,
    memoryPeakMb: 128,
    requestedIps: [],
    requestedHosts: [],
    requestCount: 0,
    status: "completed",
    startedAt: "2026-01-01T00:00:00Z",
    finishedAt: "2026-01-01T00:01:00Z",
    ...overrides
  };
}

test("returns all 6 dimensions", () => {
  const result = computeDimensionalScores(makeResult());

  assert.equal(Object.keys(result.dimensions).length, 6);
  for (const dim of ALL_DIMENSIONS) {
    assert.ok(typeof result.dimensions[dim] === "number", `${dim} should be a number`);
    assert.ok(result.dimensions[dim] >= 0 && result.dimensions[dim] <= 100, `${dim} should be 0-100`);
  }
});

test("overallScore is a weighted average", () => {
  const result = computeDimensionalScores(makeResult());

  assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
});

test("healthcheck passed boosts task_execution", () => {
  const passed = computeDimensionalScores(makeResult({ healthcheckPassed: true }));
  const failed = computeDimensionalScores(makeResult({ healthcheckPassed: false }));

  assert.ok(passed.dimensions.task_execution > failed.dimensions.task_execution);
});

test("high resource usage reduces engineering score", () => {
  const low = computeDimensionalScores(makeResult({ cpuAvgMilli: 50, memoryPeakMb: 64 }));
  const high = computeDimensionalScores(makeResult({ cpuAvgMilli: 3000, memoryPeakMb: 2048 }));

  assert.ok(low.dimensions.engineering > high.dimensions.engineering);
});

test("network violations reduce compliance score", () => {
  const clean = computeDimensionalScores(makeResult());
  const violated = computeDimensionalScores(makeResult({
    requestCount: 5,
    reasonCode: "UNDECLARED_EGRESS",
    actionReconciliation: {
      declaredHosts: ["api.example.com"],
      observedHosts: ["evil.com"],
      undeclaredObservedHosts: ["evil.com"],
      declaredUnobservedHosts: ["api.example.com"]
    }
  }));

  assert.ok(clean.dimensions.compliance > violated.dimensions.compliance);
});

test("evaluations contribute to dimensional scores", () => {
  const result = computeDimensionalScores(makeResult({
    answerEvaluations: [
      { questionId: "q1", category: "functionality", score: 90, passed: true, reasoning: "ok", securityFlags: [] },
      { questionId: "q2", category: "security", score: 85, passed: true, reasoning: "ok", securityFlags: [] },
      { questionId: "q6", category: "authorization_boundary", score: 70, passed: true, reasoning: "ok", securityFlags: [] }
    ]
  }));

  // functionality → task_execution, security/auth_boundary → security
  assert.ok(result.dimensions.task_execution > 50, "task_execution should be boosted by functionality eval");
  assert.ok(result.dimensions.security > 50, "security should be boosted by security+auth_boundary evals");
});
