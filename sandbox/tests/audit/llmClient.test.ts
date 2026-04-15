import test from "node:test";
import assert from "node:assert/strict";

import {
  createLlmClient,
  type LlmClient,
  type FetchLike
} from "../../src/audit/llmClient";
import type {
  AuditQuestionContext,
  AuditQuestionConfig
} from "../../src/audit/auditQuestionTypes";

const SAMPLE_CONTEXT: AuditQuestionContext = {
  agentName: "risk-scorer",
  image: "registry.example.com/risk-scorer:v1",
  allowedHosts: ["api.risk.com"],
  allowedRpcEndpoints: ["https://rpc.polygon.example.com"]
};

const VALID_QUESTIONS_JSON = JSON.stringify([
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
    expectedBehavior: "Should deny"
  }
]);

// ── mock provider ──────────────────────────────────────────────────

test("mock client returns hardcoded questions without calling fetch", async () => {
  const config: AuditQuestionConfig = {
    provider: "mock",
    apiKey: "",
    model: "",
    questionCount: 5
  };

  let fetchCalled = false;
  const fetchImpl: FetchLike = async () => {
    fetchCalled = true;
    return new Response("", { status: 500 });
  };

  const client = createLlmClient(config, fetchImpl);
  const questions = await client.generateAuditQuestions(SAMPLE_CONTEXT);

  assert.equal(fetchCalled, false, "mock should not call fetch");
  assert.ok(questions.length > 0, "mock should return questions");
  assert.ok(questions.length <= config.questionCount, "mock should respect questionCount");

  for (const q of questions) {
    assert.ok(q.id, "each question should have an id");
    assert.ok(q.category, "each question should have a category");
    assert.ok(q.question, "each question should have a question");
    assert.ok(q.expectedBehavior, "each question should have expectedBehavior");
  }
});

test("mock client limits questions to the configured questionCount", async () => {
  const config: AuditQuestionConfig = {
    provider: "mock",
    apiKey: "",
    model: "",
    questionCount: 2
  };

  const client = createLlmClient(config);
  const questions = await client.generateAuditQuestions(SAMPLE_CONTEXT);

  assert.equal(questions.length, 2);
});

// ── openai provider ────────────────────────────────────────────────

test("openai client sends correct request format", async () => {
  const captured: Array<{ url: string; headers: Record<string, string>; body: Record<string, unknown> }> = [];

  const fetchImpl: FetchLike = async (input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    const headers: Record<string, string> = {};

    if (init?.headers && typeof init.headers === "object" && !Array.isArray(init.headers)) {
      for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
        headers[k] = v;
      }
    }

    captured.push({
      url: String(input),
      headers,
      body
    });

    return new Response(
      JSON.stringify({
        choices: [
          { message: { content: VALID_QUESTIONS_JSON } }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  const config: AuditQuestionConfig = {
    provider: "openai",
    apiKey: "sk-test-key",
    model: "gpt-4o",
    questionCount: 2
  };

  const client = createLlmClient(config, fetchImpl);
  const questions = await client.generateAuditQuestions(SAMPLE_CONTEXT);

  assert.equal(captured.length, 1);
  assert.ok(
    captured[0].url.includes("openai.com"),
    "should call OpenAI API"
  );
  assert.equal(
    captured[0].headers["authorization"],
    "Bearer sk-test-key"
  );
  assert.equal(captured[0].body.model, "gpt-4o");
  assert.ok(Array.isArray(captured[0].body.messages), "body should have messages array");
  assert.ok(questions.length > 0, "should return parsed questions");
});

test("openai client throws on non-200 response", async () => {
  const fetchImpl: FetchLike = async () =>
    new Response(JSON.stringify({ error: { message: "quota exceeded" } }), {
      status: 429,
      headers: { "content-type": "application/json" }
    });

  const config: AuditQuestionConfig = {
    provider: "openai",
    apiKey: "sk-test-key",
    model: "gpt-4o",
    questionCount: 2
  };

  const client = createLlmClient(config, fetchImpl);

  await assert.rejects(
    () => client.generateAuditQuestions(SAMPLE_CONTEXT),
    /LLM API request failed/i
  );
});

// ── anthropic provider ─────────────────────────────────────────────

test("anthropic client sends correct request format", async () => {
  const captured: Array<{ url: string; headers: Record<string, string>; body: Record<string, unknown> }> = [];

  const fetchImpl: FetchLike = async (input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    const headers: Record<string, string> = {};

    if (init?.headers && typeof init.headers === "object" && !Array.isArray(init.headers)) {
      for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
        headers[k] = v;
      }
    }

    captured.push({
      url: String(input),
      headers,
      body
    });

    return new Response(
      JSON.stringify({
        content: [
          { type: "text", text: VALID_QUESTIONS_JSON }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  const config: AuditQuestionConfig = {
    provider: "anthropic",
    apiKey: "sk-ant-test-key",
    model: "claude-sonnet-4-20250514",
    questionCount: 2
  };

  const client = createLlmClient(config, fetchImpl);
  const questions = await client.generateAuditQuestions(SAMPLE_CONTEXT);

  assert.equal(captured.length, 1);
  assert.ok(
    captured[0].url.includes("anthropic.com"),
    "should call Anthropic API"
  );
  assert.equal(
    captured[0].headers["x-api-key"],
    "sk-ant-test-key"
  );
  assert.equal(captured[0].body.model, "claude-sonnet-4-20250514");
  assert.ok(Array.isArray(captured[0].body.messages), "body should have messages array");
  assert.ok(questions.length > 0, "should return parsed questions");
});

test("anthropic client throws on non-200 response", async () => {
  const fetchImpl: FetchLike = async () =>
    new Response(JSON.stringify({ error: { message: "invalid api key" } }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });

  const config: AuditQuestionConfig = {
    provider: "anthropic",
    apiKey: "bad-key",
    model: "claude-sonnet-4-20250514",
    questionCount: 2
  };

  const client = createLlmClient(config, fetchImpl);

  await assert.rejects(
    () => client.generateAuditQuestions(SAMPLE_CONTEXT),
    /LLM API request failed/i
  );
});

// ── openai responses format ────────────────────────────────────────

test("openai client uses /responses endpoint and input field when apiFormat is responses", async () => {
  const captured: Array<{ url: string; body: Record<string, unknown> }> = [];

  const fetchImpl: FetchLike = async (input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    captured.push({ url: String(input), body });

    return new Response(
      JSON.stringify({
        output: [
          {
            type: "message",
            status: "completed",
            content: [{ type: "output_text", text: VALID_QUESTIONS_JSON }]
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  const config: AuditQuestionConfig = {
    provider: "openai",
    apiKey: "sk-test-key",
    model: "gpt-5.4-pro",
    questionCount: 2,
    apiBaseUrl: "https://api.jiekou.ai/openai/v1",
    apiFormat: "responses"
  };

  const client = createLlmClient(config, fetchImpl);
  const questions = await client.generateAuditQuestions(SAMPLE_CONTEXT);

  assert.equal(captured.length, 1);
  assert.equal(captured[0].url, "https://api.jiekou.ai/openai/v1/responses");
  assert.ok(Array.isArray(captured[0].body.input), "body should have input array");
  assert.equal(captured[0].body.model, "gpt-5.4-pro");
  assert.equal(captured[0].body.temperature, undefined, "responses format should not send temperature");
  assert.ok(questions.length > 0);
});

test("openai client uses custom apiBaseUrl for chat format", async () => {
  const captured: Array<{ url: string }> = [];

  const fetchImpl: FetchLike = async (input, init) => {
    captured.push({ url: String(input) });
    return new Response(
      JSON.stringify({ choices: [{ message: { content: VALID_QUESTIONS_JSON } }] }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  const config: AuditQuestionConfig = {
    provider: "openai",
    apiKey: "sk-test",
    model: "gpt-4o",
    questionCount: 2,
    apiBaseUrl: "https://proxy.example.com/v1"
  };

  const client = createLlmClient(config, fetchImpl);
  await client.generateAuditQuestions(SAMPLE_CONTEXT);

  assert.equal(captured[0].url, "https://proxy.example.com/v1/chat/completions");
});

test("openai responses client throws on empty output array", async () => {
  const fetchImpl: FetchLike = async () =>
    new Response(JSON.stringify({ output: [] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });

  const config: AuditQuestionConfig = {
    provider: "openai",
    apiKey: "sk-test",
    model: "gpt-5.4-pro",
    questionCount: 2,
    apiFormat: "responses"
  };

  const client = createLlmClient(config, fetchImpl);
  await assert.rejects(
    () => client.generateAuditQuestions(SAMPLE_CONTEXT),
    /no output in Responses API/i
  );
});

// ── edge cases ─────────────────────────────────────────────────────

test("createLlmClient returns object with generateAuditQuestions method", () => {
  const config: AuditQuestionConfig = {
    provider: "mock",
    apiKey: "",
    model: "",
    questionCount: 5
  };

  const client = createLlmClient(config);

  assert.equal(typeof client.generateAuditQuestions, "function");
});

test("openai client handles malformed response body", async () => {
  const fetchImpl: FetchLike = async () =>
    new Response("not json", {
      status: 200,
      headers: { "content-type": "text/plain" }
    });

  const config: AuditQuestionConfig = {
    provider: "openai",
    apiKey: "sk-test-key",
    model: "gpt-4o",
    questionCount: 2
  };

  const client = createLlmClient(config, fetchImpl);

  await assert.rejects(
    () => client.generateAuditQuestions(SAMPLE_CONTEXT),
    /failed to parse LLM response/i
  );
});

test("anthropic client handles malformed response body", async () => {
  const fetchImpl: FetchLike = async () =>
    new Response("not json", {
      status: 200,
      headers: { "content-type": "text/plain" }
    });

  const config: AuditQuestionConfig = {
    provider: "anthropic",
    apiKey: "sk-ant-test-key",
    model: "claude-sonnet-4-20250514",
    questionCount: 2
  };

  const client = createLlmClient(config, fetchImpl);

  await assert.rejects(
    () => client.generateAuditQuestions(SAMPLE_CONTEXT),
    /failed to parse LLM response/i
  );
});
