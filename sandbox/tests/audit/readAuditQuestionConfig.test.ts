import test from "node:test";
import assert from "node:assert/strict";

import { readAuditQuestionConfig } from "../../src/audit/readAuditQuestionConfig";

test("readAuditQuestionConfig returns mock provider when AUDIT_LLM_PROVIDER is mock", () => {
  const config = readAuditQuestionConfig({
    AUDIT_LLM_PROVIDER: "mock"
  });

  assert.equal(config.provider, "mock");
  assert.equal(config.apiKey, "");
  assert.equal(config.questionCount, 5);
});

test("readAuditQuestionConfig returns openai config with defaults", () => {
  const config = readAuditQuestionConfig({
    AUDIT_LLM_PROVIDER: "openai",
    AUDIT_LLM_API_KEY: "sk-test-key"
  });

  assert.equal(config.provider, "openai");
  assert.equal(config.apiKey, "sk-test-key");
  assert.equal(config.model, "gpt-4o");
  assert.equal(config.questionCount, 5);
});

test("readAuditQuestionConfig returns anthropic config with defaults", () => {
  const config = readAuditQuestionConfig({
    AUDIT_LLM_PROVIDER: "anthropic",
    AUDIT_LLM_API_KEY: "sk-ant-test-key"
  });

  assert.equal(config.provider, "anthropic");
  assert.equal(config.apiKey, "sk-ant-test-key");
  assert.equal(config.model, "claude-sonnet-4-20250514");
  assert.equal(config.questionCount, 5);
});

test("readAuditQuestionConfig respects custom model and question count", () => {
  const config = readAuditQuestionConfig({
    AUDIT_LLM_PROVIDER: "openai",
    AUDIT_LLM_API_KEY: "sk-test-key",
    AUDIT_LLM_MODEL: "gpt-4-turbo",
    AUDIT_QUESTION_COUNT: "10"
  });

  assert.equal(config.model, "gpt-4-turbo");
  assert.equal(config.questionCount, 10);
});

test("readAuditQuestionConfig defaults to mock when AUDIT_LLM_PROVIDER is absent", () => {
  const config = readAuditQuestionConfig({});

  assert.equal(config.provider, "mock");
});

test("readAuditQuestionConfig throws for unknown provider", () => {
  assert.throws(
    () =>
      readAuditQuestionConfig({
        AUDIT_LLM_PROVIDER: "unknown-provider"
      }),
    /unsupported AUDIT_LLM_PROVIDER/i
  );
});

test("readAuditQuestionConfig throws when openai provider has no api key", () => {
  assert.throws(
    () =>
      readAuditQuestionConfig({
        AUDIT_LLM_PROVIDER: "openai"
      }),
    /AUDIT_LLM_API_KEY is required/i
  );
});

test("readAuditQuestionConfig throws when anthropic provider has no api key", () => {
  assert.throws(
    () =>
      readAuditQuestionConfig({
        AUDIT_LLM_PROVIDER: "anthropic"
      }),
    /AUDIT_LLM_API_KEY is required/i
  );
});

test("readAuditQuestionConfig clamps question count to at least 1", () => {
  const config = readAuditQuestionConfig({
    AUDIT_LLM_PROVIDER: "mock",
    AUDIT_QUESTION_COUNT: "0"
  });

  assert.equal(config.questionCount, 1);
});

test("readAuditQuestionConfig clamps question count to at most 20", () => {
  const config = readAuditQuestionConfig({
    AUDIT_LLM_PROVIDER: "mock",
    AUDIT_QUESTION_COUNT: "100"
  });

  assert.equal(config.questionCount, 20);
});

test("readAuditQuestionConfig ignores non-numeric question count", () => {
  const config = readAuditQuestionConfig({
    AUDIT_LLM_PROVIDER: "mock",
    AUDIT_QUESTION_COUNT: "abc"
  });

  assert.equal(config.questionCount, 5);
});
