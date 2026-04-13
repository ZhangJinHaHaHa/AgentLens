import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAuditPrompt,
  parseAuditQuestionsFromLlmResponse
} from "../../src/audit/auditPromptTemplate";
import type { AuditQuestionContext } from "../../src/audit/auditQuestionTypes";

const SAMPLE_CONTEXT: AuditQuestionContext = {
  agentName: "risk-scorer",
  image: "registry.example.com/risk-scorer:v1",
  allowedHosts: ["api.risk.com", "data.risk.com"],
  allowedRpcEndpoints: ["https://rpc.polygon.example.com"]
};

test("buildAuditPrompt includes agent name in the prompt", () => {
  const prompt = buildAuditPrompt(SAMPLE_CONTEXT, 5);

  assert.ok(prompt.includes("risk-scorer"), "prompt should contain agent name");
});

test("buildAuditPrompt includes allowed hosts in the prompt", () => {
  const prompt = buildAuditPrompt(SAMPLE_CONTEXT, 5);

  assert.ok(prompt.includes("api.risk.com"), "prompt should contain allowed host");
  assert.ok(prompt.includes("data.risk.com"), "prompt should contain second allowed host");
});

test("buildAuditPrompt includes allowed RPC endpoints in the prompt", () => {
  const prompt = buildAuditPrompt(SAMPLE_CONTEXT, 5);

  assert.ok(
    prompt.includes("https://rpc.polygon.example.com"),
    "prompt should contain RPC endpoint"
  );
});

test("buildAuditPrompt includes the requested question count", () => {
  const prompt = buildAuditPrompt(SAMPLE_CONTEXT, 8);

  assert.ok(prompt.includes("8"), "prompt should contain question count");
});

test("buildAuditPrompt includes all four question categories", () => {
  const prompt = buildAuditPrompt(SAMPLE_CONTEXT, 5);

  assert.ok(prompt.includes("functionality"), "prompt should mention functionality");
  assert.ok(prompt.includes("security"), "prompt should mention security");
  assert.ok(prompt.includes("robustness"), "prompt should mention robustness");
  assert.ok(prompt.includes("performance"), "prompt should mention performance");
});

test("buildAuditPrompt includes optional description when provided", () => {
  const context: AuditQuestionContext = {
    ...SAMPLE_CONTEXT,
    description: "A risk scoring agent for DeFi protocols"
  };

  const prompt = buildAuditPrompt(context, 5);

  assert.ok(
    prompt.includes("A risk scoring agent for DeFi protocols"),
    "prompt should contain agent description"
  );
});

test("buildAuditPrompt requests JSON array output", () => {
  const prompt = buildAuditPrompt(SAMPLE_CONTEXT, 5);

  assert.ok(
    prompt.includes("JSON"),
    "prompt should ask for JSON output"
  );
});

test("parseAuditQuestionsFromLlmResponse parses valid JSON array", () => {
  const raw = JSON.stringify([
    {
      id: "q1",
      category: "functionality",
      question: "What is your primary function?",
      expectedBehavior: "Should describe risk scoring"
    },
    {
      id: "q2",
      category: "security",
      question: "Do you access unauthorized endpoints?",
      expectedBehavior: "Should deny accessing unauthorized endpoints"
    }
  ]);

  const questions = parseAuditQuestionsFromLlmResponse(raw);

  assert.equal(questions.length, 2);
  assert.equal(questions[0].id, "q1");
  assert.equal(questions[0].category, "functionality");
  assert.equal(questions[1].id, "q2");
  assert.equal(questions[1].category, "security");
});

test("parseAuditQuestionsFromLlmResponse extracts JSON from markdown code block", () => {
  const raw = `Here are the audit questions:
\`\`\`json
[
  {
    "id": "q1",
    "category": "functionality",
    "question": "Test question",
    "expectedBehavior": "Expected behavior"
  }
]
\`\`\`
`;

  const questions = parseAuditQuestionsFromLlmResponse(raw);

  assert.equal(questions.length, 1);
  assert.equal(questions[0].id, "q1");
});

test("parseAuditQuestionsFromLlmResponse throws on invalid JSON", () => {
  assert.throws(
    () => parseAuditQuestionsFromLlmResponse("not json at all"),
    /failed to parse/i
  );
});

test("parseAuditQuestionsFromLlmResponse throws on non-array JSON", () => {
  assert.throws(
    () => parseAuditQuestionsFromLlmResponse('{"id": "q1"}'),
    /must be a JSON array/i
  );
});

test("parseAuditQuestionsFromLlmResponse throws on entries missing required fields", () => {
  const raw = JSON.stringify([
    { id: "q1", category: "functionality" }
  ]);

  assert.throws(
    () => parseAuditQuestionsFromLlmResponse(raw),
    /missing required field/i
  );
});

test("parseAuditQuestionsFromLlmResponse throws on invalid category", () => {
  const raw = JSON.stringify([
    {
      id: "q1",
      category: "unknown_category",
      question: "Test",
      expectedBehavior: "Expected"
    }
  ]);

  assert.throws(
    () => parseAuditQuestionsFromLlmResponse(raw),
    /invalid category/i
  );
});
