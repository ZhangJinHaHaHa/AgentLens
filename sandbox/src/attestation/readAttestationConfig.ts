export interface AttestationConfig {
  apiUrl: string;
  authToken?: string;
  providerType: string;
  timeoutMs: number;
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

export function readAttestationConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): AttestationConfig {
  const timeoutInput = env.AUDIT_ATTESTATION_TIMEOUT_MS;
  const timeoutMs =
    typeof timeoutInput === "string" && /^\d+$/u.test(timeoutInput)
      ? Number.parseInt(timeoutInput, 10)
      : 10000;

  return {
    apiUrl: requireEnvValue(env, "AUDIT_ATTESTATION_API_URL"),
    authToken: env.AUDIT_ATTESTATION_AUTH_TOKEN,
    providerType: env.AUDIT_ATTESTATION_PROVIDER_TYPE || "http-tee",
    timeoutMs
  };
}
