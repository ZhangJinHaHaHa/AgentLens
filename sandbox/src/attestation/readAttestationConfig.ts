/**
 * 这是审计进程侧的证明客户端配置入口，把环境变量收敛为 URL、凭据、provider 标识、超时及可选验证策略。
 * API URL 必须存在，令牌同时接受现行和旧的变量名以保持部署兼容；只有配置了至少一项期望时才生成 verification，避免悄然改变旧环境行为。
 * 超时仅接受纯数字字符串，缺失或异常值回落到 10 秒；这里不探测网络、不验证 URL 公网属性，也不证明 measurement/quote 格式正确。
 * 返回对象不修改传入环境记录，敏感令牌只被传递而不记录；缺少强制 URL 时在任何 I/O 前同步失败。
 * 是否允许未启用 verification 的模式属于部署策略，本解析器不替代上层的安全基线决策。
 */
export interface AttestationVerificationConfig {
  expectedProviderType?: string;
  expectedMeasurement?: string;
  expectedQuoteFormat?: string;
  verifyReportDataBinding?: boolean;
}

export interface AttestationConfig {
  apiUrl: string;
  authToken?: string;
  providerType: string;
  timeoutMs: number;
  verification?: AttestationVerificationConfig;
}

function requireEnvValue(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  key: string
): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function readVerificationFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): AttestationVerificationConfig | undefined {
  const expectedProviderType = env.AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE;
  const expectedMeasurement = env.AUDIT_ATTESTATION_EXPECTED_MEASUREMENT;
  const expectedQuoteFormat = env.AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT;
  const verifyReportDataBinding = env.AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING === "true";

  const hasAnyExpectation =
    Boolean(expectedProviderType) ||
    Boolean(expectedMeasurement) ||
    Boolean(expectedQuoteFormat) ||
    verifyReportDataBinding;

  if (!hasAnyExpectation) {
    return undefined;
  }

  const verification: AttestationVerificationConfig = {};

  if (expectedProviderType) {
    verification.expectedProviderType = expectedProviderType;
  }
  if (expectedMeasurement) {
    verification.expectedMeasurement = expectedMeasurement;
  }
  if (expectedQuoteFormat) {
    verification.expectedQuoteFormat = expectedQuoteFormat;
  }
  if (verifyReportDataBinding) {
    verification.verifyReportDataBinding = true;
  }

  return verification;
}

export function readAttestationConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): AttestationConfig {
  const timeoutInput = env.AUDIT_ATTESTATION_TIMEOUT_MS;
  const timeoutMs =
    typeof timeoutInput === "string" && /^\d+$/u.test(timeoutInput)
      ? Number.parseInt(timeoutInput, 10)
      : 10000;

  const verification = readVerificationFromEnv(env);

  return {
    apiUrl: requireEnvValue(env, "AUDIT_ATTESTATION_API_URL"),
    authToken: env.AUDIT_ATTESTATION_AUTH_TOKEN ?? env.AUDIT_ATTESTATION_API_TOKEN,
    providerType: env.AUDIT_ATTESTATION_PROVIDER_TYPE || "http-tee",
    timeoutMs,
    ...(verification ? { verification } : {})
  };
}
