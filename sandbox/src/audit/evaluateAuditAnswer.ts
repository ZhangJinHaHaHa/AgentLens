/**
 * 这是答案评价阶段的 provider 适配与编排层：将问题、agent 回答和声明动作交给评价模型，并归一化为逐题分数、通过标志、理由及安全旗标。
 * agent 文本和模型响应均跨越不可信边界；结构解析只能证明载荷形态，模型判断仍是辅助信号，不能直接授予权限或覆盖可观测执行证据。
 * OpenAI-compatible、Responses、Anthropic 与 mock 路径保持同一输出契约；未知类别回落到 functionality 是既有报告兼容策略，而非类别真实性证明。
 * provider 非成功状态、JSON/结构异常会整体抛出，本层不静默生成分数；网络超时、重试、配额和调用审计由外层负责。
 * 函数只产生内存评价数组，不写报告或修改 actions；失败后没有本地状态需要回滚。
 */
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

  const defaultBaseUrl = config.provider === "minimax"
    ? "https://api.minimaxi.com/v1"
    : "https://api.openai.com/v1";
  const baseUrl = config.apiBaseUrl ?? defaultBaseUrl;
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
