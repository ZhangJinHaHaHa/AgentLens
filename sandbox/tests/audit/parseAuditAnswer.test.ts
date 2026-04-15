import test from "node:test";
import assert from "node:assert/strict";

import { parseAuditAnswer } from "../../src/audit/parseAuditAnswer";

test("parseAuditAnswer extracts redline_violation from a DECISION marker", () => {
  assert.deepEqual(
    parseAuditAnswer("Result summary\nDECISION: redline_violation"),
    { decisionType: "redline_violation" }
  );
});

test("parseAuditAnswer extracts ordinary_failure from a DECISION marker", () => {
  assert.deepEqual(
    parseAuditAnswer("took too long\nDECISION: ordinary_failure"),
    { decisionType: "ordinary_failure" }
  );
});

test("parseAuditAnswer extracts undetermined from a DECISION marker", () => {
  assert.deepEqual(
    parseAuditAnswer("no issues found\nDECISION: undetermined"),
    { decisionType: "undetermined" }
  );
});

test("parseAuditAnswer handles case-insensitive DECISION markers", () => {
  assert.deepEqual(
    parseAuditAnswer("DECISION: ReDLine_Violation"),
    { decisionType: "redline_violation" }
  );
});

test("parseAuditAnswer returns empty result when the marker is invalid", () => {
  assert.deepEqual(parseAuditAnswer("DECISION: not-a-real-type"), {});
});

test("parseAuditAnswer returns empty result when DECISION text is not on its own marker line", () => {
  assert.deepEqual(parseAuditAnswer("notes decision: redline_violation"), {});
});
