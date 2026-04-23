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
}

export function readAppConfig(env: AppEnv): AppConfigResult {
  const rpcUrl = readEnvString(env.VITE_AUDIT_RPC_URL);
  if (rpcUrl.length === 0) {
    return { ok: false, error: "VITE_AUDIT_RPC_URL is required." };
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
