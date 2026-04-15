import test from "node:test";
import assert from "node:assert/strict";

import { runAttestationCommandProviderCli } from "../../src/cli/attestationCommandProvider";

test("runAttestationCommandProviderCli reads stdin JSON and writes canonical response JSON", async () => {
  const stdout: string[] = [];

  const exitCode = await runAttestationCommandProviderCli(
    {
      TEE_COMMAND_PROVIDER_MODE: "demo",
      TEE_COMMAND_PROVIDER_QUOTE_FORMAT: "mock-quote"
    },
    JSON.stringify({
      schemaVersion: "audit-attestation-request.v1",
      eventKey: "0xabc:0",
      tokenId: "1",
      manifestHash: "a".repeat(64),
      evidenceRoot: "b".repeat(64),
      manifestUrl: "https://example.com/manifest.json"
    }),
    {
      writeStdout: (chunk) => {
        stdout.push(chunk);
      }
    }
  );

  const parsed = JSON.parse(stdout.join("")) as Record<string, string>;

  assert.equal(exitCode, 0);
  assert.equal(typeof parsed.measurement, "string");
  assert.equal(parsed.quoteFormat, "mock-quote");
  assert.equal(typeof parsed.sessionPublicKey, "string");
  assert.equal(typeof parsed.quote, "string");
});

test("runAttestationCommandProviderCli delegates to an external command in real mode", async () => {
  const stdout: string[] = [];
  const calls: Array<{ file: string; args: string[]; stdin: string }> = [];
  const input = JSON.stringify({
    schemaVersion: "audit-attestation-request.v1",
    eventKey: "0xabc:0",
    tokenId: "1",
    manifestHash: "a".repeat(64),
    evidenceRoot: "b".repeat(64),
    manifestUrl: "https://example.com/manifest.json"
  });

  const exitCode = await runAttestationCommandProviderCli(
    {
      TEE_COMMAND_PROVIDER_MODE: "real",
      TEE_COMMAND_PROVIDER_COMMAND: "/usr/local/bin/real-tee",
      TEE_COMMAND_PROVIDER_ARGS: "--mode\nattest"
    },
    input,
    {
      writeStdout: (chunk: string) => {
        stdout.push(chunk);
      },
      runCommand: async (request) => {
        calls.push(request);
        return {
          stdout: JSON.stringify({
            measurement: "m".repeat(64),
            quoteFormat: "nitro",
            sessionPublicKey: "spk-123",
            quote: "quote-abc"
          }),
          stderr: "",
          exitCode: 0
        };
      }
    }
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [
    {
      file: "/usr/local/bin/real-tee",
      args: ["--mode", "attest"],
      stdin: input
    }
  ]);
});
