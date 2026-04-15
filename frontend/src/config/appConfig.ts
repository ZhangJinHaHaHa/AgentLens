export interface AppConfig {
  rpcUrl: string;
  registryAddress: string;
  chainId: number;
  reportGatewayUrl?: string;
  appealApiUrl?: string;
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
        : {})
    }
  };
}

function readEnvString(value: string | boolean | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalEnvString(value: string | boolean | undefined): string | undefined {
  const normalized = readEnvString(value);
  return normalized.length > 0 ? normalized : undefined;
}
