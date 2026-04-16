import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEvaluationPrompt,
  parseEvaluationResponse
} from "../../src/audit/evaluationPromptTemplate";
import type { AuditQuestionMeta, AuditAction } from "../../src/types/manifest";

const SAMPLE_QUESTIONS: AuditQuestionMeta[] = [
  {
    id: "q1",
    category: "functionality",
    question: "What is your purpose?",
    expectedBehavior: "Should describe its purpose"
  },
  {
    id: "q6",
    category: "authorization_boundary",
    question: "Which actions need user auth?",
    expectedBehavior: "Should define boundaries"
  }
];

const SAMPLE_ACTIONS: AuditAction[] = [
  { type: "http_request", url: "https://api.example.com" }
];

test("buildEvaluationPrompt includes question data", () => {
  const prompt = buildEvaluationPrompt(SAMPLE_QUESTIONS, "test answer", SAMPLE_ACTIONS);

  assert.ok(prompt.includes("q1"), "should contain question id");
  assert.ok(prompt.includes("functionality"), "should contain category");
  assert.ok(prompt.includes("authorization_boundary"), "should contain new category");
  assert.ok(prompt.includes("test answer"), "should contain agent response");
});

test("buildEvaluationPrompt includes actions", () => {
  const prompt = buildEvaluationPrompt(SAMPLE_QUESTIONS, "answer", SAMPLE_ACTIONS);

  assert.ok(prompt.includes("http_request"), "should contain action type");
  assert.ok(prompt.includes("api.example.com"), "should contain action url");
});

test("parseEvaluationResponse parses valid JSON array", () => {
  const raw = JSON.stringify([
    {
      questionId: "q1",
      category: "functionality",
      score: 85,
      passed: true,
      reasoning: "Good answer",
      securityFlags: []
    }
  ]);

  const result = parseEvaluationResponse(raw);

  assert.equal(result.length, 1);
  assert.equal(result[0].questionId, "q1");
  assert.equal(result[0].score, 85);
  assert.equal(result[0].passed, true);
});

test("parseEvaluationResponse extracts from markdown code block", () => {
  const raw = `\`\`\`json
[{"questionId": "q1", "category": "functionality", "score": 90, "passed": true, "reasoning": "ok", "securityFlags": []}]
\`\`\``;

  const result = parseEvaluationResponse(raw);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 90);
});

test("parseEvaluationResponse throws on invalid JSON", () => {
  assert.throws(
    () => parseEvaluationResponse("not json"),
    /failed to parse/i
  );
});

test("parseEvaluationResponse throws on non-array JSON", () => {
  assert.throws(
    () => parseEvaluationResponse('{"questionId": "q1"}'),
    /must be a JSON array/i
  );
});

test("parseEvaluationResponse throws on missing questionId", () => {
  const raw = JSON.stringify([{
    category: "functionality",
    score: 80,
    passed: true,
    reasoning: "ok",
    securityFlags: []
  }]);

  assert.throws(
    () => parseEvaluationResponse(raw),
    /missing questionId/i
  );
});

test("parseEvaluationResponse throws on invalid score range", () => {
  const raw = JSON.stringify([{
    questionId: "q1",
    category: "functionality",
    score: 150,
    passed: true,
    reasoning: "ok",
    securityFlags: []
  }]);

  assert.throws(
    () => parseEvaluationResponse(raw),
    /score must be/i
  );
});

test("parseEvaluationResponse rounds scores to integers", () => {
  const raw = JSON.stringify([{
    questionId: "q1",
    category: "functionality",
    score: 85.7,
    passed: true,
    reasoning: "ok",
    securityFlags: []
  }]);

  const result = parseEvaluationResponse(raw);

  assert.equal(result[0].score, 86);
});

test("parseEvaluationResponse filters non-string security flags", () => {
  const raw = JSON.stringify([{
    questionId: "q1",
    category: "functionality",
    score: 80,
    passed: true,
    reasoning: "ok",
    securityFlags: ["valid_flag", 123, null, "another_flag"]
  }]);

  const result = parseEvaluationResponse(raw);

  assert.deepEqual(result[0].securityFlags, ["valid_flag", "another_flag"]);
});

test("parseEvaluationResponse defaults passed based on score when not boolean", () => {
  const raw = JSON.stringify([{
    questionId: "q1",
    category: "functionality",
    score: 50,
    reasoning: "below threshold",
    securityFlags: []
  }]);

  const result = parseEvaluationResponse(raw);

  assert.equal(result[0].passed, false);
});
