import test from "node:test";
import assert from "node:assert/strict";

import { readAttestationVerifyConfig } from "../../src/attestation/readAttestationVerifyConfig";

test("readAttestationVerifyConfig returns undefined expectations when env is empty", () => {
  assert.deepEqual(readAttestationVerifyConfig({}), {
    expectedProviderType: undefined,
    expectedMeasurement: undefined,
    expectedQuoteFormat: undefined,
    verifyReportDataBinding: false
  });
});

test("readAttestationVerifyConfig reads expected verifier metadata from env", () => {
  assert.deepEqual(
    readAttestationVerifyConfig({
      AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE: "mock-tee",
      AUDIT_ATTESTATION_EXPECTED_MEASUREMENT: "m".repeat(64),
      AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT: "mock-quote"
    }),
    {
      expectedProviderType: "mock-tee",
      expectedMeasurement: "m".repeat(64),
      expectedQuoteFormat: "mock-quote",
      verifyReportDataBinding: false
    }
  );
});

test("readAttestationVerifyConfig reads verifyReportDataBinding from env", () => {
  assert.deepEqual(
    readAttestationVerifyConfig({
      AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT: "sgx-dcap-v3",
      AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING: "true"
    }),
    {
      expectedProviderType: undefined,
      expectedMeasurement: undefined,
      expectedQuoteFormat: "sgx-dcap-v3",
      verifyReportDataBinding: true
    }
  );
});
