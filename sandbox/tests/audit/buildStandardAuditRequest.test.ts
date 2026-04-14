import test from "node:test";
import assert from "node:assert/strict";

import type { AuditHistoryMessage } from "../../src/types/manifest";
import {
  STANDARD_AUDIT_QUESTION,
  buildStandardAuditRequest
} from "../../src/audit/buildStandardAuditRequest";

test("buildStandardAuditRequest normalizes missing history to an empty array", () => {
  const request = buildStandardAuditRequest({ taskId: "task-123" });

  assert.deepEqual(request.context.history, []);
});

test("buildStandardAuditRequest preserves optional current_block and env_vars", () => {
  const request = buildStandardAuditRequest({
    taskId: "task-123",
    currentBlock: 123,
    envVars: ["MANIFEST_URL=https://example.com/manifest.json"]
  });

  assert.equal(request.context.current_block, 123);
  assert.deepEqual(request.context.env_vars, ["MANIFEST_URL=https://example.com/manifest.json"]);
});

test("buildStandardAuditRequest copies env_vars so the request is stable", () => {
  const envVars = ["MANIFEST_URL=https://example.com/manifest.json"];

  const request = buildStandardAuditRequest({
    taskId: "task-123",
    envVars
  });

  assert.notStrictEqual(request.context.env_vars, envVars);
  assert.deepEqual(request.context.env_vars, envVars);
});

test("buildStandardAuditRequest copies history array so the request is stable", () => {
  const history: AuditHistoryMessage[] = [
    { role: "system", content: "bootstrapping" }
  ];

  const request = buildStandardAuditRequest({ taskId: "task-123", history });

  assert.notStrictEqual(request.context.history, history);
  assert.deepEqual(request.context.history, history);
  assert.notStrictEqual(request.context.history[0], history[0]);
});

test("buildStandardAuditRequest rejects invalid currentBlock values", () => {
  assert.throws(
    () => buildStandardAuditRequest({ taskId: "task-123", currentBlock: -1 }),
    /currentBlock must be a non-negative integer/i
  );

  assert.throws(
    () => buildStandardAuditRequest({ taskId: "task-123", currentBlock: 1.5 }),
    /currentBlock must be a non-negative integer/i
  );
});

test("buildStandardAuditRequest rejects invalid history roles", () => {
  const history = [
    { role: "invalid", content: "oops" }
  ] as unknown as AuditHistoryMessage[];

  assert.throws(
    () => buildStandardAuditRequest({ taskId: "task-123", history }),
    /history role/i
  );
});

test("buildStandardAuditRequest rejects non-string history content", () => {
  const history = [
    { role: "assistant", content: 123 }
  ] as unknown as AuditHistoryMessage[];

  assert.throws(
    () => buildStandardAuditRequest({ taskId: "task-123", history }),
    /history content/i
  );
});

test("buildStandardAuditRequest rejects non-array history values", () => {
  assert.throws(
    () =>
      buildStandardAuditRequest({
        taskId: "task-123",
        history: "bad-input" as unknown as AuditHistoryMessage[]
      }),
    /history must be an array/i
  );
});

test("buildStandardAuditRequest rejects invalid envVars values", () => {
  assert.throws(
    () =>
      buildStandardAuditRequest({
        taskId: "task-123",
        envVars: "bad-input" as unknown as string[]
      }),
    /envVars must be an array of strings/i
  );

  assert.throws(
    () =>
      buildStandardAuditRequest({
        taskId: "task-123",
        envVars: ["OK=1", 123] as unknown as string[]
      }),
    /envVars must be an array of strings/i
  );
});

test("buildStandardAuditRequest rejects null history entries", () => {
  const history = [null] as unknown as AuditHistoryMessage[];

  assert.throws(
    () => buildStandardAuditRequest({ taskId: "task-123", history }),
    /history entry/i
  );
});

test("buildStandardAuditRequest rejects entries missing content", () => {
  const history = [
    { role: "user" }
  ] as unknown as AuditHistoryMessage[];

  assert.throws(
    () => buildStandardAuditRequest({ taskId: "task-123", history }),
    /history content/i
  );
});

test("buildStandardAuditRequest enforces json response_format", () => {
  const request = buildStandardAuditRequest({ taskId: "task-123" });

  assert.equal(request.constraints.response_format, "json");
});

test("buildStandardAuditRequest consistently uses the canonical question text", () => {
  const request = buildStandardAuditRequest({ taskId: "task-123" });

  assert.equal(request.question, STANDARD_AUDIT_QUESTION);
  assert.match(request.question, /DECISION:/);
});
