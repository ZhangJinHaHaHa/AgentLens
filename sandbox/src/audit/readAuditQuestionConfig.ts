import type { AuditLlmProvider, AuditQuestionConfig } from "./auditQuestionTypes";

const VALID_PROVIDERS = new Set<AuditLlmProvider>(["openai", "anthropic", "mock"]);

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514"
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
  const apiBaseUrl = env.AUDIT_LLM_API_BASE_URL || undefined;
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
