import test from "node:test";
import assert from "node:assert/strict";

import { runAttestationApiCli } from "../../src/cli/attestationApi";

test("runAttestationApiCli starts the attestation API server and logs the listening config", async () => {
  const listenCalls: Array<{ host: string; port: number }> = [];
  const stdout: string[] = [];

  await runAttestationApiCli(
    {
      AUDIT_ATTESTATION_SERVICE_HOST: "127.0.0.1",
      AUDIT_ATTESTATION_SERVICE_PORT: "3311",
      AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE: "mock"
    },
    {
      createServer() {
        return {
          once(_event: string, _handler: (...args: unknown[]) => void) {
            return this;
          },
          listen(port: number, host: string, callback: () => void) {
            listenCalls.push({ host, port });
            callback();
            return this;
          }
        };
      },
      writeStdout(line: string) {
        stdout.push(line);
      }
    }
  );

  assert.deepEqual(listenCalls, [{ host: "127.0.0.1", port: 3311 }]);
  assert.deepEqual(stdout, [
    `${JSON.stringify({
      type: "attestation-api-listening",
      host: "127.0.0.1",
      port: 3311,
      providerMode: "mock"
    })}\n`
  ]);
});

test("runAttestationApiCli uses the selected provider for real-http mode", async () => {
  const listenCalls: Array<{ host: string; port: number }> = [];
  const providerCalls: Array<Record<string, unknown>> = [];

  await runAttestationApiCli(
    {
      AUDIT_ATTESTATION_SERVICE_HOST: "127.0.0.1",
      AUDIT_ATTESTATION_SERVICE_PORT: "3311",
      AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE: "real-http",
      AUDIT_ATTESTATION_REAL_BACKEND_URL: "https://tee-backend.example/quote",
      AUDIT_ATTESTATION_REAL_PROVIDER_TYPE: "nitro-enclave",
      AUDIT_ATTESTATION_REAL_BACKEND_AUTH_TOKEN: "token-123",
      AUDIT_ATTESTATION_REAL_BACKEND_TIMEOUT_MS: "2500"
    },
    {
      createServer(_config, _provider) {
        return {
          once(_event: string, _handler: (...args: unknown[]) => void) {
            return this;
          },
          listen(port: number, host: string, callback: () => void) {
            listenCalls.push({ host, port });
            callback();
            return this;
          }
        };
      },
      createRealTeeHttpProvider(config) {
        providerCalls.push(config as unknown as Record<string, unknown>);
        return {
          attest: async () => ({
            measurement: "m".repeat(64),
            quoteFormat: "nitro",
            sessionPublicKey: "spk-123",
            quote: "quote-abc"
          })
        };
      }
    }
  );

  assert.deepEqual(listenCalls, [{ host: "127.0.0.1", port: 3311 }]);
  assert.equal(providerCalls.length, 1);
  assert.deepEqual(
    {
      ...providerCalls[0],
      quoteValidator: typeof providerCalls[0]?.quoteValidator
    },
    {
      backendUrl: "https://tee-backend.example/quote",
      authToken: "token-123",
      providerType: "nitro-enclave",
      timeoutMs: 2500,
      quoteValidation: {
        expectedProviderType: undefined,
        expectedMeasurement: undefined,
        expectedQuoteFormat: undefined
      },
      quoteValidator: "object"
    }
  );
});

test("runAttestationApiCli uses the selected provider for command mode", async () => {
  const listenCalls: Array<{ host: string; port: number }> = [];
  const providerCalls: Array<Record<string, unknown>> = [];

  await runAttestationApiCli(
    {
      AUDIT_ATTESTATION_SERVICE_HOST: "127.0.0.1",
      AUDIT_ATTESTATION_SERVICE_PORT: "3311",
      AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE: "command",
      AUDIT_ATTESTATION_COMMAND: "/usr/local/bin/mock-tee",
      AUDIT_ATTESTATION_COMMAND_ARGS: "--mode\nattest",
      AUDIT_ATTESTATION_COMMAND_PROVIDER_TYPE: "nitro-enclave",
      AUDIT_ATTESTATION_COMMAND_TIMEOUT_MS: "2500"
    },
    {
      createServer(_config, _provider) {
        return {
          once(_event: string, _handler: (...args: unknown[]) => void) {
            return this;
          },
          listen(port: number, host: string, callback: () => void) {
            listenCalls.push({ host, port });
            callback();
            return this;
          }
        };
      },
      createCommandTeeProvider(config) {
        providerCalls.push(config as unknown as Record<string, unknown>);
        return {
          attest: async () => ({
            measurement: "m".repeat(64),
            quoteFormat: "nitro",
            sessionPublicKey: "spk-123",
            quote: "quote-abc"
          })
        };
      }
    }
  );

  assert.deepEqual(listenCalls, [{ host: "127.0.0.1", port: 3311 }]);
  assert.equal(providerCalls.length, 1);
  assert.deepEqual(
    {
      ...providerCalls[0],
      quoteValidator: typeof providerCalls[0]?.quoteValidator
    },
    {
      command: "/usr/local/bin/mock-tee",
      args: ["--mode", "attest"],
      providerType: "nitro-enclave",
      timeoutMs: 2500,
      quoteValidation: {
        expectedProviderType: undefined,
        expectedMeasurement: undefined,
        expectedQuoteFormat: undefined
      },
      quoteValidator: "object"
    }
  );
});
