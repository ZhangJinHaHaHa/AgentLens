/**
 * 这是动态问题生成的环境配置边界，负责 provider 白名单、API key 要求、模型/基础 URL 默认值以及题目数量的有界归一化。
 * 真实 provider 缺少密钥会在联网前失败；mock 明确返回空凭据，保证本地流程不会意外依赖外部秘密。
 * 题数被限制在 1–20，非整数回到 5；只有显式 `responses` 才选择 Responses API，其余值沿用 chat 默认，以兼容既有部署。
 * 本解析器不测试密钥、不请求 endpoint，也不判断自定义 base URL 是否可信，出站治理必须在部署和网络层完成。
 * 返回新配置对象且不会修改传入环境记录，所有校验故障都发生在外部副作用之前。
 */
import type { AuditLlmProvider, AuditQuestionConfig } from "./auditQuestionTypes";

const VALID_PROVIDERS = new Set<AuditLlmProvider>(["openai", "anthropic", "minimax", "mock"]);

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  minimax: "MiniMax-M2.7"
};

const DEFAULT_API_BASE_URLS: Record<string, string> = {
  minimax: "https://api.minimaxi.com/v1"
};

const DEFAULT_QUESTION_COUNT = 5;
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 20;

function clampQuestionCount(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_QUESTION_COUNT;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return DEFAULT_QUESTION_COUNT;
  }

  if (parsed < MIN_QUESTION_COUNT) {
    return MIN_QUESTION_COUNT;
  }

  if (parsed > MAX_QUESTION_COUNT) {
    return MAX_QUESTION_COUNT;
  }

  return parsed;
}

/**
 * Read audit question configuration from an environment-variable-like record.
 * Throws on invalid provider or missing API key for real providers.
 */
export function readAuditQuestionConfig(
  env: Record<string, string | undefined>
): AuditQuestionConfig {
  const providerRaw = env.AUDIT_LLM_PROVIDER ?? "mock";

  if (!VALID_PROVIDERS.has(providerRaw as AuditLlmProvider)) {
    throw new Error(`Unsupported AUDIT_LLM_PROVIDER: "${providerRaw}"`);
  }

  const provider = providerRaw as AuditLlmProvider;
  const questionCount = clampQuestionCount(env.AUDIT_QUESTION_COUNT);

  if (provider === "mock") {
    return {
      provider,
      apiKey: "",
      model: "",
      questionCount
    };
  }

  const apiKey = env.AUDIT_LLM_API_KEY;

  if (!apiKey) {
    throw new Error("AUDIT_LLM_API_KEY is required when provider is not mock");
  }

  const model = env.AUDIT_LLM_MODEL ?? DEFAULT_MODELS[provider] ?? "";
  const apiBaseUrl = env.AUDIT_LLM_API_BASE_URL || DEFAULT_API_BASE_URLS[provider] || undefined;
  const apiFormatRaw = env.AUDIT_LLM_API_FORMAT;
  const apiFormat = apiFormatRaw === "responses" ? "responses" as const : undefined;

  return {
    provider,
    apiKey,
    model,
    questionCount,
    ...(apiBaseUrl ? { apiBaseUrl } : {}),
    ...(apiFormat ? { apiFormat } : {})
  };
}
