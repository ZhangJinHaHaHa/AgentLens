/**
 * 前端运行配置的唯一归一化边界：把 Vite 注入的字符串/布尔值整理为可判别的 `AppConfigResult`，供 RPC、合约和网关客户端消费。
 * 读取过程不发起网络请求，也不持久化或缓存；仅在浏览器存在 `window` 时把相对 RPC 路径补成当前 origin，服务端渲染仍保留原值。
 * 必填项只保证非空，链 ID 额外限定为安全的非负十进制整数；地址、URL 的可达性及所属网络仍须由后续客户端或服务端验证。
 * 所有 `VITE_*` 值都会进入浏览器包，不能承载密钥；证明配置也只是向界面说明监听器策略，真正的证明校验发生在服务端监听器。
 * 缺失或非法必填项以 `ok: false` 返回且不做隐式回退或重试，调用方必须阻止依赖这些配置的读写操作。
 * 可选字段采用“空值即缺省”的兼容约定，证明绑定开关仅接受字面值 `true`，避免宽松真值改变既有部署语义。
 */
// Mirrors the listener's AUDIT_ATTESTATION_EXPECTED_* pinning so the UI can
// tell users exactly which enclave and quote format the verifier is enforcing.
// These values are informational for the UI; the actual enforcement happens
// inside the listener at audit time.
export interface AttestationUiConfig {
  expectedProviderType?: string;
  expectedMeasurement?: string;
  expectedQuoteFormat?: string;
  verifyReportDataBinding?: boolean;
}

export interface AppConfig {
  rpcUrl: string;
  registryAddress: string;
  chainId: number;
  reportGatewayUrl?: string;
  appealApiUrl?: string;
  attestation?: AttestationUiConfig;
  marketplaceAddress?: string;
  reviewRegistryAddress?: string;
  zkVerifierAddress?: string;
}

export type AppConfigResult =
  | {
      ok: true;
      config: AppConfig;
    }
  | {
      ok: false;
      error: string;
    };

export interface AppEnv {
  [key: string]: string | boolean | undefined;
  VITE_AUDIT_RPC_URL?: string;
  VITE_AUDIT_REGISTRY_ADDRESS?: string;
  VITE_AUDIT_CHAIN_ID?: string;
  VITE_AUDIT_REPORT_GATEWAY_URL?: string;
  VITE_AUDIT_APPEAL_API_URL?: string;
  VITE_AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE?: string;
  VITE_AUDIT_ATTESTATION_EXPECTED_MEASUREMENT?: string;
  VITE_AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT?: string;
  VITE_AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING?: string;
  VITE_AUDIT_MARKETPLACE_ADDRESS?: string;
  VITE_AUDIT_REVIEW_REGISTRY_ADDRESS?: string;
  VITE_AUDIT_ZK_VERIFIER_ADDRESS?: string;
}

export function readAppConfig(env: AppEnv): AppConfigResult {
  const rpcUrl = readEnvString(env.VITE_AUDIT_RPC_URL);
  if (rpcUrl.length === 0) {
    return { ok: false, error: "Audit RPC endpoint is not configured." };
  }

  const registryAddress = readEnvString(env.VITE_AUDIT_REGISTRY_ADDRESS);
  if (registryAddress.length === 0) {
    return { ok: false, error: "VITE_AUDIT_REGISTRY_ADDRESS is required." };
  }

  const chainIdInput = readEnvString(env.VITE_AUDIT_CHAIN_ID);
  if (!/^\d+$/.test(chainIdInput)) {
    return {
      ok: false,
      error: "VITE_AUDIT_CHAIN_ID must be a non-negative integer."
    };
  }

  const chainId = Number(chainIdInput);
  if (!Number.isSafeInteger(chainId) || chainId < 0) {
    return {
      ok: false,
      error: "VITE_AUDIT_CHAIN_ID must be a non-negative integer."
    };
  }

  const resolvedRpcUrl =
    rpcUrl.startsWith("/") && typeof globalThis.window !== "undefined"
      ? `${globalThis.window.location.origin}${rpcUrl}`
      : rpcUrl;

  const attestation = readAttestationConfigFromEnv(env);

  return {
    ok: true,
    config: {
      rpcUrl: resolvedRpcUrl,
      registryAddress,
      chainId,
      ...(readOptionalEnvString(env.VITE_AUDIT_REPORT_GATEWAY_URL)
        ? { reportGatewayUrl: readOptionalEnvString(env.VITE_AUDIT_REPORT_GATEWAY_URL) }
        : {}),
      ...(readOptionalEnvString(env.VITE_AUDIT_APPEAL_API_URL)
        ? { appealApiUrl: readOptionalEnvString(env.VITE_AUDIT_APPEAL_API_URL) }
        : {}),
      ...(attestation ? { attestation } : {}),
      ...(readOptionalEnvString(env.VITE_AUDIT_MARKETPLACE_ADDRESS)
        ? { marketplaceAddress: readOptionalEnvString(env.VITE_AUDIT_MARKETPLACE_ADDRESS) }
        : {}),
      ...(readOptionalEnvString(env.VITE_AUDIT_REVIEW_REGISTRY_ADDRESS)
        ? { reviewRegistryAddress: readOptionalEnvString(env.VITE_AUDIT_REVIEW_REGISTRY_ADDRESS) }
        : {}),
      ...(readOptionalEnvString(env.VITE_AUDIT_ZK_VERIFIER_ADDRESS)
        ? { zkVerifierAddress: readOptionalEnvString(env.VITE_AUDIT_ZK_VERIFIER_ADDRESS) }
        : {})
    }
  };
}

function readAttestationConfigFromEnv(env: AppEnv): AttestationUiConfig | undefined {
  const expectedProviderType = readOptionalEnvString(env.VITE_AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE);
  const expectedMeasurement = readOptionalEnvString(env.VITE_AUDIT_ATTESTATION_EXPECTED_MEASUREMENT);
  const expectedQuoteFormat = readOptionalEnvString(env.VITE_AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT);
  const verifyReportDataBinding =
    readOptionalEnvString(env.VITE_AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING) === "true";

  if (!expectedProviderType && !expectedMeasurement && !expectedQuoteFormat && !verifyReportDataBinding) {
    return undefined;
  }

  const config: AttestationUiConfig = {};
  if (expectedProviderType) {
    config.expectedProviderType = expectedProviderType;
  }
  if (expectedMeasurement) {
    config.expectedMeasurement = expectedMeasurement;
  }
  if (expectedQuoteFormat) {
    config.expectedQuoteFormat = expectedQuoteFormat;
  }
  if (verifyReportDataBinding) {
    config.verifyReportDataBinding = true;
  }

  return config;
}

function readEnvString(value: string | boolean | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalEnvString(value: string | boolean | undefined): string | undefined {
  const normalized = readEnvString(value);
  return normalized.length > 0 ? normalized : undefined;
}
