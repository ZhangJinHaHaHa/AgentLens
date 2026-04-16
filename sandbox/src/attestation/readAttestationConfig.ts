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
    authToken: env.AUDIT_ATTESTATION_AUTH_TOKEN,
    providerType: env.AUDIT_ATTESTATION_PROVIDER_TYPE || "http-tee",
    timeoutMs,
    ...(verification ? { verification } : {})
  };
}
