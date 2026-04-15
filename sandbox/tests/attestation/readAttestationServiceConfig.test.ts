import test from "node:test";
import assert from "node:assert/strict";

import { readAttestationServiceConfig } from "../../src/attestation/readAttestationServiceConfig";

test("readAttestationServiceConfig rejects missing provider mode", () => {
  assert.throws(
    () =>
      readAttestationServiceConfig({
        AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE: ""
      }),
    /AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE is required/
  );
});

test("readAttestationServiceConfig returns canonical config with defaults", () => {
  const config = readAttestationServiceConfig({
    AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE: "mock"
  });

  assert.deepEqual(config, {
    host: "127.0.0.1",
    port: 3311,
    providerMode: "mock"
  });
});

test("readAttestationServiceConfig accepts explicit host and port", () => {
  const config = readAttestationServiceConfig({
    AUDIT_ATTESTATION_SERVICE_HOST: "0.0.0.0",
    AUDIT_ATTESTATION_SERVICE_PORT: "4411",
    AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE: "mock"
  });

  assert.deepEqual(config, {
    host: "0.0.0.0",
    port: 4411,
    providerMode: "mock"
  });
});

test("readAttestationServiceConfig requires backendUrl for real-http provider mode", () => {
  assert.throws(
    () =>
      readAttestationServiceConfig({
        AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE: "real-http"
      }),
    /AUDIT_ATTESTATION_REAL_BACKEND_URL is required/
  );
});

test("readAttestationServiceConfig returns real-http backend config", () => {
  const config = readAttestationServiceConfig({
    AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE: "real-http",
    AUDIT_ATTESTATION_REAL_BACKEND_URL: "https://tee-backend.example/quote",
    AUDIT_ATTESTATION_REAL_PROVIDER_TYPE: "nitro-enclave",
    AUDIT_ATTESTATION_REAL_BACKEND_AUTH_TOKEN: "token-123",
    AUDIT_ATTESTATION_REAL_BACKEND_TIMEOUT_MS: "2500",
    AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE: "nitro-enclave",
    AUDIT_ATTESTATION_EXPECTED_MEASUREMENT: "m".repeat(64),
    AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT: "nitro"
  });

  assert.deepEqual(config, {
    host: "127.0.0.1",
    port: 3311,
    providerMode: "real-http",
    realBackend: {
      backendUrl: "https://tee-backend.example/quote",
      authToken: "token-123",
      providerType: "nitro-enclave",
      timeoutMs: 2500,
      quoteValidation: {
        expectedProviderType: "nitro-enclave",
        expectedMeasurement: "m".repeat(64),
        expectedQuoteFormat: "nitro"
      }
    }
  });
});

test("readAttestationServiceConfig requires command for command provider mode", () => {
  assert.throws(
    () =>
      readAttestationServiceConfig({
        AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE: "command"
      }),
    /AUDIT_ATTESTATION_COMMAND is required/
  );
});

test("readAttestationServiceConfig returns command provider config", () => {
  const config = readAttestationServiceConfig({
    AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE: "command",
    AUDIT_ATTESTATION_COMMAND: "/usr/local/bin/mock-tee",
    AUDIT_ATTESTATION_COMMAND_ARGS: "--mode\nattest",
    AUDIT_ATTESTATION_COMMAND_PROVIDER_TYPE: "nitro-enclave",
    AUDIT_ATTESTATION_COMMAND_TIMEOUT_MS: "2500",
    AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE: "nitro-enclave",
    AUDIT_ATTESTATION_EXPECTED_MEASUREMENT: "m".repeat(64),
    AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT: "nitro"
  });

  assert.deepEqual(config, {
    host: "127.0.0.1",
    port: 3311,
    providerMode: "command",
    commandBackend: {
      command: "/usr/local/bin/mock-tee",
      args: ["--mode", "attest"],
      providerType: "nitro-enclave",
      timeoutMs: 2500,
      quoteValidation: {
        expectedProviderType: "nitro-enclave",
        expectedMeasurement: "m".repeat(64),
        expectedQuoteFormat: "nitro"
      }
    }
  });
});
