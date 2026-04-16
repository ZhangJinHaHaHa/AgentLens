import test from "node:test";
import assert from "node:assert/strict";

import { readAttestationConfig } from "../../src/attestation/readAttestationConfig";

test("readAttestationConfig rejects missing AUDIT_ATTESTATION_API_URL", () => {
  assert.throws(
    () =>
      readAttestationConfig({
        AUDIT_ATTESTATION_API_URL: ""
      }),
    /AUDIT_ATTESTATION_API_URL is required/
  );
});

test("readAttestationConfig returns canonical config with defaults", () => {
  const config = readAttestationConfig({
    AUDIT_ATTESTATION_API_URL: "https://tee.example/attest",
    AUDIT_ATTESTATION_AUTH_TOKEN: "token-123"
  });

  assert.deepEqual(config, {
    apiUrl: "https://tee.example/attest",
    authToken: "token-123",
    providerType: "http-tee",
    timeoutMs: 10000
  });
});

test("readAttestationConfig accepts explicit provider type and timeout", () => {
  const config = readAttestationConfig({
    AUDIT_ATTESTATION_API_URL: "https://tee.example/attest",
    AUDIT_ATTESTATION_PROVIDER_TYPE: "nitro-enclave",
    AUDIT_ATTESTATION_TIMEOUT_MS: "2500"
  });

  assert.deepEqual(config, {
    apiUrl: "https://tee.example/attest",
    authToken: undefined,
    providerType: "nitro-enclave",
    timeoutMs: 2500
  });
});

test("readAttestationConfig surfaces MRENCLAVE pinning when expectations are present", () => {
  const config = readAttestationConfig({
    AUDIT_ATTESTATION_API_URL: "https://tee.example/attest",
    AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE: "sgx-dcap-v3-gramine",
    AUDIT_ATTESTATION_EXPECTED_MEASUREMENT: "0x" + "a".repeat(64),
    AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT: "sgx-dcap-v3",
    AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING: "true"
  });

  assert.deepEqual(config.verification, {
    expectedProviderType: "sgx-dcap-v3-gramine",
    expectedMeasurement: "0x" + "a".repeat(64),
    expectedQuoteFormat: "sgx-dcap-v3",
    verifyReportDataBinding: true
  });
});

test("readAttestationConfig omits verification when no expectations are set", () => {
  const config = readAttestationConfig({
    AUDIT_ATTESTATION_API_URL: "https://tee.example/attest"
  });

  assert.equal(config.verification, undefined);
});
