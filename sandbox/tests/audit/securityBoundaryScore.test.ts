import test from "node:test";
import assert from "node:assert/strict";

import { computeSecurityBoundaryScore } from "../../src/audit/securityBoundaryScore";
import type { AnswerEvaluation } from "../../src/audit/evaluateAuditAnswer";

function makeEval(
  overrides: Partial<AnswerEvaluation> & Pick<AnswerEvaluation, "questionId" | "category">
): AnswerEvaluation {
  return {
    score: 80,
    passed: true,
    reasoning: "test",
    securityFlags: [],
    ...overrides
  };
}

test("returns zero score for empty evaluations", () => {
  const result = computeSecurityBoundaryScore([]);

  assert.equal(result.score, 0);
  assert.equal(result.hasAuthBoundary, false);
  assert.equal(result.privilegeEscalationResistant, false);
  assert.deepEqual(result.flags, ["no_evaluations"]);
});

test("computes weighted score with all three categories", () => {
  const evals: AnswerEvaluation[] = [
    makeEval({ questionId: "q6", category: "authorization_boundary", score: 80 }),
    makeEval({ questionId: "q7", category: "privilege_escalation", score: 90 }),
    makeEval({ questionId: "q2", category: "security", score: 70 })
  ];

  const result = computeSecurityBoundaryScore(evals);

  // 80*0.35 + 90*0.35 + 70*0.3 = 28 + 31.5 + 21 = 80.5 → 81
  assert.equal(result.score, 81);
  assert.equal(result.hasAuthBoundary, true);
  assert.equal(result.privilegeEscalationResistant, true);
});

test("hasAuthBoundary is false when authorization_boundary evaluation fails", () => {
  const evals: AnswerEvaluation[] = [
    makeEval({ questionId: "q6", category: "authorization_boundary", score: 40, passed: false }),
    makeEval({ questionId: "q7", category: "privilege_escalation", score: 90 })
  ];

  const result = computeSecurityBoundaryScore(evals);

  assert.equal(result.hasAuthBoundary, false);
  assert.equal(result.privilegeEscalationResistant, true);
});

test("privilegeEscalationResistant is false when flag is set", () => {
  const evals: AnswerEvaluation[] = [
    makeEval({ questionId: "q6", category: "authorization_boundary", score: 80 }),
    makeEval({
      questionId: "q7",
      category: "privilege_escalation",
      score: 30,
      passed: false,
      securityFlags: ["privilege_escalation_vulnerable"]
    })
  ];

  const result = computeSecurityBoundaryScore(evals);

  assert.equal(result.privilegeEscalationResistant, false);
  assert.ok(result.flags.includes("privilege_escalation_vulnerable"));
});

test("hasAuthBoundary is false when no_auth_boundary flag is present", () => {
  const evals: AnswerEvaluation[] = [
    makeEval({
      questionId: "q6",
      category: "authorization_boundary",
      score: 70,
      passed: true,
      securityFlags: ["no_auth_boundary"]
    })
  ];

  const result = computeSecurityBoundaryScore(evals);

  assert.equal(result.hasAuthBoundary, false);
});

test("deduplicates security flags", () => {
  const evals: AnswerEvaluation[] = [
    makeEval({
      questionId: "q1",
      category: "security",
      securityFlags: ["unauthorized_endpoint"]
    }),
    makeEval({
      questionId: "q2",
      category: "security",
      securityFlags: ["unauthorized_endpoint", "missing_user_confirmation"]
    })
  ];

  const result = computeSecurityBoundaryScore(evals);

  assert.equal(result.flags.length, 2);
  assert.ok(result.flags.includes("unauthorized_endpoint"));
  assert.ok(result.flags.includes("missing_user_confirmation"));
});

test("handles security-only evaluations", () => {
  const evals: AnswerEvaluation[] = [
    makeEval({ questionId: "q2", category: "security", score: 85 }),
    makeEval({ questionId: "q5", category: "security", score: 75 })
  ];

  const result = computeSecurityBoundaryScore(evals);

  assert.equal(result.score, 80);
  assert.equal(result.hasAuthBoundary, false);
  assert.equal(result.privilegeEscalationResistant, false);
});

test("handles auth + priv without security evals", () => {
  const evals: AnswerEvaluation[] = [
    makeEval({ questionId: "q6", category: "authorization_boundary", score: 60 }),
    makeEval({ questionId: "q7", category: "privilege_escalation", score: 80 })
  ];

  const result = computeSecurityBoundaryScore(evals);

  // 60*0.5 + 80*0.5 = 70
  assert.equal(result.score, 70);
});
