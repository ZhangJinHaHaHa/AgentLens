export interface AttestationVerifyConfig {
  expectedProviderType?: string;
  expectedMeasurement?: string;
  expectedQuoteFormat?: string;
  verifyReportDataBinding?: boolean;
}

export function readAttestationVerifyConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): AttestationVerifyConfig {
  return {
    expectedProviderType: env.AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE,
    expectedMeasurement: env.AUDIT_ATTESTATION_EXPECTED_MEASUREMENT,
    expectedQuoteFormat: env.AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT,
    verifyReportDataBinding: env.AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING === "true"
  };
}
