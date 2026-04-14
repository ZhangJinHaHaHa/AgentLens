import test from "node:test";
import assert from "node:assert/strict";

import { buildLlmAuditRequest } from "../../src/audit/buildLlmAuditRequest";
import type { AuditQuestionConfig } from "../../src/audit/auditQuestionTypes";
import type { SandboxManifest } from "../../src/types/manifest";

const SAMPLE_MANIFEST: SandboxManifest = {
  agent_name: "risk-scorer",
  image: "registry.example.com/risk-scorer:v1",
  allowed_hosts: ["api.risk.com"],
  allowed_rpc_endpoints: ["https://rpc.polygon.example.com"]
};

const MOCK_CONFIG: AuditQuestionConfig = {
  provider: "mock",
  apiKey: "",
  model: "",
  questionCount: 3
};

test("buildLlmAuditRequest returns a valid AuditSolveRequest with LLM-generated question", async () => {
  const request = await buildLlmAuditRequest({
    taskId: "task-001",
    manifest: SAMPLE_MANIFEST,
    config: MOCK_CONFIG
  });

  assert.equal(request.task_id, "task-001");
  assert.ok(request.question.length > 0, "question should be non-empty");
  assert.equal(request.constraints.response_format, "json");
  assert.ok(Array.isArray(request.context.history), "history should be an array");
});

test("buildLlmAuditRequest includes question metadata in context history", async () => {
  const request = await buildLlmAuditRequest({
    taskId: "task-002",
    manifest: SAMPLE_MANIFEST,
    config: MOCK_CONFIG
  });

  // The system message should contain information about the generated questions
  const systemMessages = request.context.history.filter((m) => m.role === "system");
  assert.ok(systemMessages.length > 0, "should have at least one system message");
  assert.ok(
    systemMessages[0].content.includes("audit"),
    "system message should mention audit context"
  );
});

test("buildLlmAuditRequest preserves optional currentBlock and envVars", async () => {
  const request = await buildLlmAuditRequest({
    taskId: "task-003",
    manifest: SAMPLE_MANIFEST,
    config: MOCK_CONFIG,
    currentBlock: 42,
    envVars: ["KEY=val"]
  });

  assert.equal(request.context.current_block, 42);
  assert.deepEqual(request.context.env_vars, ["KEY=val"]);
});

test("buildLlmAuditRequest question text includes all generated questions", async () => {
  const request = await buildLlmAuditRequest({
    taskId: "task-004",
    manifest: SAMPLE_MANIFEST,
    config: { ...MOCK_CONFIG, questionCount: 2 }
  });

  // The question should contain multiple numbered items or structured questions
  assert.ok(request.question.includes("q1"), "should include question id q1");
  assert.ok(request.question.includes("q2"), "should include question id q2");
});

test("buildLlmAuditRequest falls back to standard question on LLM failure", async () => {
  const failingConfig: AuditQuestionConfig = {
    provider: "openai",
    apiKey: "bad-key",
    model: "gpt-4o",
    questionCount: 3
  };

  // Use a fetch that always fails
  const failingFetch = async (): Promise<Response> =>
    new Response(JSON.stringify({ error: "fail" }), { status: 500 });

  const request = await buildLlmAuditRequest({
    taskId: "task-005",
    manifest: SAMPLE_MANIFEST,
    config: failingConfig,
    fetchImpl: failingFetch
  });

  // Should fall back to standard audit question
  assert.ok(request.question.includes("DECISION:"), "fallback should use standard audit question");
});

test("buildLlmAuditRequest with mock config produces deterministic questions", async () => {
  const request1 = await buildLlmAuditRequest({
    taskId: "task-006",
    manifest: SAMPLE_MANIFEST,
    config: MOCK_CONFIG
  });

  const request2 = await buildLlmAuditRequest({
    taskId: "task-006",
    manifest: SAMPLE_MANIFEST,
    config: MOCK_CONFIG
  });

  assert.equal(request1.question, request2.question);
});
