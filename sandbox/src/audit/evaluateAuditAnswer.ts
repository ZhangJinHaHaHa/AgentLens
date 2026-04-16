import type { AuditQuestionCategory } from "./auditQuestionTypes";
import type { AuditQuestionMeta, AuditAction } from "../types/manifest";
import type { LlmClient } from "./llmClient";
import { createLlmClient } from "./llmClient";
import type { AuditQuestionConfig } from "./auditQuestionTypes";
import {
  buildEvaluationPrompt,
  parseEvaluationResponse
} from "./evaluationPromptTemplate";

/** Result of evaluating a single audit question answer. */
export interface AnswerEvaluation {
  questionId: string;
  category: AuditQuestionCategory;
  score: number;
  passed: boolean;
  reasoning: string;
  securityFlags: string[];
}

/** Configuration for the evaluation LLM call. */
export interface LlmClientConfig {
  provider: AuditQuestionConfig["provider"];
  apiKey: string;
  model: string;
  apiBaseUrl?: string;
  apiFormat?: "chat" | "responses";
}

/** Abstraction over LLM for evaluation (allows injection for testing). */
export interface EvaluationLlmClient {
  evaluate(prompt: string): Promise<string>;
}

/**
 * Create an evaluation LLM client that sends the evaluation prompt and
 * returns raw text. Reuses the audit LLM infrastructure.
 */
export function createEvaluationLlmClient(
  config: LlmClientConfig,
  fetchImpl?: typeof fetch
): EvaluationLlmClient {
  if (config.provider === "mock") {
    return { evaluate: createMockEvaluator() };
  }

  const auditConfig: AuditQuestionConfig = {
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    questionCount: 1,
    apiBaseUrl: config.apiBaseUrl,
    apiFormat: config.apiFormat
  };

  const baseUrl = config.apiBaseUrl ?? "https://api.openai.com/v1";
  const format = config.apiFormat ?? "chat";

  return {
    async evaluate(prompt: string): Promise<string> {
      if (config.provider === "anthropic") {
        return callAnthropic(config, prompt, fetchImpl);
      }
      return callOpenAi(config, prompt, baseUrl, format, fetchImpl);
    }
  };
}

async function callOpenAi(
  config: LlmClientConfig,
  prompt: string,
  baseUrl: string,
  format: string,
  fetchImpl?: typeof fetch
): Promise<string> {
  const impl = fetchImpl ?? fetch;
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const url = format === "responses"
    ? `${cleanBase}/responses`
    : `${cleanBase}/chat/completions`;

  const requestBody = format === "responses"
    ? { model: config.model, input: [{ role: "user", content: prompt }], max_output_tokens: 16384 }
    : { model: config.model, messages: [{ role: "user", content: prompt }], temperature: 0.3 };

  const response = await impl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`Evaluation LLM request failed with status ${response.status}`);
  }

  const body = await response.json() as Record<string, unknown>;

  if (format === "responses") {
    const output = body.output as Array<Record<string, unknown>>;
    const msg = output?.find((i) => i.type === "message");
    const content = (msg?.content as Array<Record<string, unknown>>)?.find(
      (b) => b.type === "output_text"
    );
    return (content?.text as string) ?? "";
  }

  const choices = body.choices as Array<Record<string, unknown>>;
  const message = choices?.[0]?.message as Record<string, unknown>;
  return (message?.content as string) ?? "";
}

async function callAnthropic(
  config: LlmClientConfig,
  prompt: string,
  fetchImpl?: typeof fetch
): Promise<string> {
  const impl = fetchImpl ?? fetch;

  const response = await impl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    throw new Error(`Evaluation LLM request failed with status ${response.status}`);
  }

  const body = await response.json() as Record<string, unknown>;
  const content = body.content as Array<Record<string, unknown>>;
  const textBlock = content?.find((b) => b.type === "text");
  return (textBlock?.text as string) ?? "";
}

function createMockEvaluator(): (prompt: string) => Promise<string> {
  return async (_prompt: string) => {
    return JSON.stringify([
      { questionId: "q1", category: "functionality", score: 80, passed: true, reasoning: "Mock: adequate functionality", securityFlags: [] },
      { questionId: "q2", category: "security", score: 90, passed: true, reasoning: "Mock: refused unauthorized endpoint", securityFlags: [] },
      { questionId: "q3", category: "robustness", score: 75, passed: true, reasoning: "Mock: handled gracefully", securityFlags: [] },
      { questionId: "q4", category: "performance", score: 70, passed: true, reasoning: "Mock: described strategy", securityFlags: [] },
      { questionId: "q5", category: "security", score: 85, passed: true, reasoning: "Mock: endpoints within bounds", securityFlags: [] },
      { questionId: "q6", category: "authorization_boundary", score: 60, passed: true, reasoning: "Mock: partial boundary definition", securityFlags: ["no_auth_boundary"] },
      { questionId: "q7", category: "privilege_escalation", score: 95, passed: true, reasoning: "Mock: refused escalation", securityFlags: [] }
    ]);
  };
}

/**
 * Evaluate all audit question answers using an LLM.
 *
 * Controlled by AUDIT_EVALUATION_ENABLED env var (default: true).
 * Uses AUDIT_EVAL_LLM_MODEL for a potentially cheaper evaluation model.
 */
export async function evaluateAuditAnswers(
  questions: AuditQuestionMeta[],
  agentResponse: string,
  actions: AuditAction[],
  llmConfig: LlmClientConfig,
  evaluationClient?: EvaluationLlmClient
): Promise<AnswerEvaluation[]> {
  if (questions.length === 0) {
    return [];
  }

  const client = evaluationClient ?? createEvaluationLlmClient(llmConfig);

  const prompt = buildEvaluationPrompt(questions, agentResponse, actions);
  const rawResponse = await client.evaluate(prompt);
  const rawEvaluations = parseEvaluationResponse(rawResponse);

  const validCategories = new Set([
    "functionality", "security", "robustness", "performance",
    "authorization_boundary", "privilege_escalation"
  ]);

  return rawEvaluations.map((raw) => ({
    questionId: raw.questionId,
    category: (validCategories.has(raw.category)
      ? raw.category
      : "functionality") as AuditQuestionCategory,
    score: raw.score,
    passed: raw.passed,
    reasoning: raw.reasoning,
    securityFlags: raw.securityFlags
  }));
}
