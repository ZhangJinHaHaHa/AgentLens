import test from "node:test";
import assert from "node:assert/strict";

import { createCommandTeeProvider } from "../../src/attestation/commandTeeProvider";

test("createCommandTeeProvider invokes the configured command with one JSON request on stdin", async () => {
  const calls: Array<{
    file: string;
    args: string[];
    stdin: string;
  }> = [];

  const provider = createCommandTeeProvider({
    command: "/usr/local/bin/mock-tee",
    args: ["--mode", "attest"],
    providerType: "nitro-enclave",
    timeoutMs: 2500,
    runCommand: async (input) => {
      calls.push(input);
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
  });

  const result = await provider.attest({
    schemaVersion: "audit-attestation-request.v1",
    eventKey: "0xabc:0",
    tokenId: "1",
    manifestHash: "a".repeat(64),
    evidenceRoot: "e".repeat(64),
    manifestUrl: "https://example.com/manifest.json"
  });

  assert.deepEqual(calls, [
    {
      file: "/usr/local/bin/mock-tee",
      args: ["--mode", "attest"],
      stdin: JSON.stringify({
        schemaVersion: "audit-attestation-request.v1",
        eventKey: "0xabc:0",
        tokenId: "1",
        manifestHash: "a".repeat(64),
        evidenceRoot: "e".repeat(64),
        manifestUrl: "https://example.com/manifest.json"
      })
    }
  ]);
  assert.deepEqual(result, {
    measurement: "m".repeat(64),
    quoteFormat: "nitro",
    sessionPublicKey: "spk-123",
    quote: "quote-abc"
  });
});

test("createCommandTeeProvider rejects non-zero exit codes", async () => {
  const provider = createCommandTeeProvider({
    command: "/usr/local/bin/mock-tee",
    providerType: "nitro-enclave",
    timeoutMs: 2500,
    runCommand: async () => ({
      stdout: "",
      stderr: "boom",
      exitCode: 1
    })
  });

  await assert.rejects(
    () =>
      provider.attest({
        schemaVersion: "audit-attestation-request.v1",
        eventKey: "0xabc:0",
        tokenId: "1",
        manifestHash: "a".repeat(64),
        evidenceRoot: "e".repeat(64),
        manifestUrl: "https://example.com/manifest.json"
      }),
    /command TEE provider failed with exit code 1: boom/
  );
});
