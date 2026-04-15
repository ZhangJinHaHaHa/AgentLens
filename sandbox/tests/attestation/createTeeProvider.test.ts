import test from "node:test";
import assert from "node:assert/strict";

import { createTeeProvider } from "../../src/attestation/createTeeProvider";
import type { TeeProvider } from "../../src/attestation/mockTeeProvider";
import type { AttestationServiceConfig } from "../../src/attestation/readAttestationServiceConfig";
import {
  buildMockSgxDcapQuote,
  computeExpectedReportData
} from "../../src/attestation/sgxDcapQuoteValidator";

test("createTeeProvider selects the mock provider for mock mode", () => {
  const calls: string[] = [];
  const provider = createTeeProvider(
    {
      host: "127.0.0.1",
      port: 3311,
      providerMode: "mock"
    },
    {
      createMockTeeProvider: () => {
        calls.push("mock");
        return {
          attest: async () => ({
            measurement: "a".repeat(64),
            quoteFormat: "mock-quote",
            sessionPublicKey: "mock-session-public-key",
            quote: "mock-attestation-quote"
          })
        } satisfies TeeProvider;
      }
    }
  );

  assert.equal(typeof provider.attest, "function");
  assert.deepEqual(calls, ["mock"]);
});

test("createTeeProvider selects the real-http provider and passes backend config", () => {
  const calls: Array<Record<string, unknown>> = [];
  const config: AttestationServiceConfig = {
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
  };

  const provider = createTeeProvider(config, {
    createRealTeeHttpProvider: (input) => {
      calls.push(input as unknown as Record<string, unknown>);
      return {
        attest: async () => ({
          measurement: "m".repeat(64),
          quoteFormat: "nitro",
          sessionPublicKey: "spk-123",
          quote: "quote-abc"
        })
      } satisfies TeeProvider;
    }
  });

  assert.equal(typeof provider.attest, "function");
  assert.equal(calls.length, 1);
  assert.deepEqual(
    {
      ...calls[0],
      quoteValidator: typeof calls[0]?.quoteValidator
    },
    {
      backendUrl: "https://tee-backend.example/quote",
      authToken: "token-123",
      providerType: "nitro-enclave",
      timeoutMs: 2500,
      quoteValidation: {
        expectedProviderType: "nitro-enclave",
        expectedMeasurement: "m".repeat(64),
        expectedQuoteFormat: "nitro"
      },
      quoteValidator: "object"
    }
  );
});

test("createTeeProvider rejects unsupported provider modes", () => {
  assert.throws(
    () =>
      createTeeProvider({
        host: "127.0.0.1",
        port: 3311,
        providerMode: "unknown-mode"
      }),
    /Unsupported attestation provider mode: unknown-mode/
  );
});

test("createTeeProvider selects the command provider and passes backend config", () => {
  const calls: Array<Record<string, unknown>> = [];
  const config: AttestationServiceConfig = {
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
  };

  const provider = createTeeProvider(config, {
    createCommandTeeProvider: (input) => {
      calls.push(input as unknown as Record<string, unknown>);
      return {
        attest: async () => ({
          measurement: "m".repeat(64),
          quoteFormat: "nitro",
          sessionPublicKey: "spk-123",
          quote: "quote-abc"
        })
      } satisfies TeeProvider;
    }
  });

  assert.equal(typeof provider.attest, "function");
  assert.equal(calls.length, 1);
  assert.deepEqual(
    {
      ...calls[0],
      quoteValidator: typeof calls[0]?.quoteValidator
    },
    {
      command: "/usr/local/bin/mock-tee",
      args: ["--mode", "attest"],
      providerType: "nitro-enclave",
      timeoutMs: 2500,
      quoteValidation: {
        expectedProviderType: "nitro-enclave",
        expectedMeasurement: "m".repeat(64),
        expectedQuoteFormat: "nitro"
      },
      quoteValidator: "object"
    }
  );
});

test("createTeeProvider adds SGX DCAP quote validator when expectedQuoteFormat is sgx-dcap-v3", () => {
  const calls: Array<Record<string, unknown>> = [];
  const mrEnclave = "c".repeat(64);
  const config: AttestationServiceConfig = {
    host: "127.0.0.1",
    port: 3311,
    providerMode: "command",
    commandBackend: {
      command: "gramine-sgx",
      args: ["./generate-quote"],
      providerType: "sgx-dcap",
      timeoutMs: 30000,
      quoteValidation: {
        expectedProviderType: "sgx-dcap",
        expectedMeasurement: mrEnclave,
        expectedQuoteFormat: "sgx-dcap-v3"
      }
    }
  };

  const provider = createTeeProvider(config, {
    createCommandTeeProvider: (input) => {
      calls.push(input as unknown as Record<string, unknown>);
      return {
        attest: async () => ({
          measurement: mrEnclave,
          quoteFormat: "sgx-dcap-v3",
          sessionPublicKey: "spk",
          quote: buildMockSgxDcapQuote({
            mrEnclave,
            reportData: computeExpectedReportData("0xtest:0", "a".repeat(64), "b".repeat(64))
          })
        })
      } satisfies TeeProvider;
    }
  });

  assert.equal(typeof provider.attest, "function");
  assert.equal(calls.length, 1);
  assert.equal(typeof calls[0]?.quoteValidator, "object");
});
