import test from "node:test";
import assert from "node:assert/strict";

import { classifyAuditDecision } from "../../src/audit/classifyAuditDecision";

test("classifyAuditDecision returns undetermined when a completed result has no reason code", () => {
  const decision = classifyAuditDecision({ status: "completed" });

  assert.deepEqual(decision, { decisionType: "undetermined" });
});

test("classifyAuditDecision honors an answer DECISION redline_violation for completed results", () => {
  const decision = classifyAuditDecision({
    status: "completed",
    answer: "Logs...\nDECISION: redline_violation"
  });

  assert.deepEqual(decision, { decisionType: "redline_violation" });
});

test("classifyAuditDecision honors an answer DECISION ordinary_failure for completed results", () => {
  const decision = classifyAuditDecision({
    status: "completed",
    answer: "Logs...\nDECISION: ordinary_failure"
  });

  assert.deepEqual(decision, { decisionType: "ordinary_failure" });
});

test("classifyAuditDecision flags UNDECLARED_EGRESS as a redline violation", () => {
  const decision = classifyAuditDecision({
    status: "failed",
    reasonCode: "UNDECLARED_EGRESS"
  });

  assert.deepEqual(decision, { decisionType: "redline_violation" });
});

test("classifyAuditDecision flags ACTION_MISMATCH as a redline violation", () => {
  const decision = classifyAuditDecision({
    status: "failed",
    reasonCode: "ACTION_MISMATCH"
  });

  assert.deepEqual(decision, { decisionType: "redline_violation" });
});

test("classifyAuditDecision treats REQUEST_TIMEOUT as an ordinary failure", () => {
  const decision = classifyAuditDecision({
    status: "failed",
    reasonCode: "REQUEST_TIMEOUT"
  });

  assert.deepEqual(decision, { decisionType: "ordinary_failure" });
});

test("classifyAuditDecision treats MANIFEST_NAME_MISMATCH as an ordinary failure", () => {
  const decision = classifyAuditDecision({
    status: "failed",
    reasonCode: "MANIFEST_NAME_MISMATCH"
  });

  assert.deepEqual(decision, { decisionType: "ordinary_failure" });
});

test("classifyAuditDecision keeps redline when reasonCode is redline even if answer requests ordinary_failure", () => {
  const decision = classifyAuditDecision({
    status: "failed",
    reasonCode: "UNDECLARED_EGRESS",
    answer: "Logs...\nDECISION: ordinary_failure"
  });

  assert.deepEqual(decision, { decisionType: "redline_violation" });
});

test("classifyAuditDecision falls back to undetermined when answer has no valid DECISION marker", () => {
  const decision = classifyAuditDecision({
    status: "completed",
    answer: "decision: not-a-real-type"
  });

  assert.deepEqual(decision, { decisionType: "undetermined" });
});
