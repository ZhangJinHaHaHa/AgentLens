export interface ReportGatewayConfig {
  host: string;
  port: number;
  upstreamBaseUrl: string;
  authToken?: string;
  fetchTimeoutMs: number;
}

function requireEnvValue(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  key: string
): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function readNonNegativeInteger(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  key: string,
  defaultValue: number
): number {
  const rawValue = env[key];
  if (rawValue === undefined || rawValue === "") {
    return defaultValue;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${key} must be a non-negative integer`);
  }

  return Number(rawValue);
}

export function readReportGatewayConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): ReportGatewayConfig {
  const port = readNonNegativeInteger(env, "AUDIT_REPORT_GATEWAY_PORT", 3101);
  const fetchTimeoutMs = readNonNegativeInteger(
    env,
    "AUDIT_REPORT_GATEWAY_FETCH_TIMEOUT_MS",
    15000
  );

  if (port > 65535) {
    throw new Error("AUDIT_REPORT_GATEWAY_PORT must be between 0 and 65535");
  }

  if (fetchTimeoutMs <= 0) {
    throw new Error("AUDIT_REPORT_GATEWAY_FETCH_TIMEOUT_MS must be a positive integer");
  }

  return {
    host: env.AUDIT_REPORT_GATEWAY_HOST || "0.0.0.0",
    port,
    upstreamBaseUrl: normalizeBaseUrl(
      requireEnvValue(env, "AUDIT_REPORT_GATEWAY_UPSTREAM_BASE_URL")
    ),
    authToken: env.AUDIT_REPORT_GATEWAY_AUTH_TOKEN,
    fetchTimeoutMs
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
