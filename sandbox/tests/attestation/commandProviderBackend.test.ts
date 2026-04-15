import test from "node:test";
import assert from "node:assert/strict";

import {
  generateRealCommandAttestation,
  generateDemoCommandAttestation,
  parseCommandAttestationRequest
} from "../../src/attestation/commandProviderBackend";

test("parseCommandAttestationRequest validates the canonical stdin contract", () => {
  const parsed = parseCommandAttestationRequest(
    JSON.stringify({
      schemaVersion: "audit-attestation-request.v1",
      eventKey: "0xabc:0",
      tokenId: "1",
      manifestHash: "a".repeat(64),
      evidenceRoot: "b".repeat(64),
      manifestUrl: "https://example.com/manifest.json"
    })
  );

  assert.deepEqual(parsed, {
    schemaVersion: "audit-attestation-request.v1",
    eventKey: "0xabc:0",
    tokenId: "1",
    manifestHash: "a".repeat(64),
    evidenceRoot: "b".repeat(64),
    manifestUrl: "https://example.com/manifest.json"
  });
});

test("generateDemoCommandAttestation returns deterministic canonical top-level fields", async () => {
  const input = {
    schemaVersion: "audit-attestation-request.v1" as const,
    eventKey: "0xabc:0",
    tokenId: "1",
    manifestHash: "a".repeat(64),
    evidenceRoot: "b".repeat(64),
    manifestUrl: "https://example.com/manifest.json"
  };

  const first = await generateDemoCommandAttestation(input, {
    quoteFormat: "mock-quote"
  });
  const second = await generateDemoCommandAttestation(input, {
    quoteFormat: "mock-quote"
  });

  assert.deepEqual(first, second);
  assert.equal(typeof first.measurement, "string");
  assert.equal(typeof first.sessionPublicKey, "string");
  assert.equal(typeof first.quote, "string");
});

test("generateRealCommandAttestation invokes the configured external command with stdin JSON", async () => {
  const calls: Array<{ file: string; args: string[]; stdin: string }> = [];
  const input = {
    schemaVersion: "audit-attestation-request.v1" as const,
    eventKey: "0xabc:0",
    tokenId: "1",
    manifestHash: "a".repeat(64),
    evidenceRoot: "b".repeat(64),
    manifestUrl: "https://example.com/manifest.json"
  };

  const result = await generateRealCommandAttestation(input, {
    command: "/usr/local/bin/real-tee",
    args: ["--mode", "attest"],
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
  });

  assert.deepEqual(calls, [
    {
      file: "/usr/local/bin/real-tee",
      args: ["--mode", "attest"],
      stdin: JSON.stringify(input)
    }
  ]);
  assert.deepEqual(result, {
    measurement: "m".repeat(64),
    quoteFormat: "nitro",
    sessionPublicKey: "spk-123",
    quote: "quote-abc"
  });
});

test("generateRealCommandAttestation rejects non-zero exit codes", async () => {
  const input = {
    schemaVersion: "audit-attestation-request.v1" as const,
    eventKey: "0xabc:0",
    tokenId: "1",
    manifestHash: "a".repeat(64),
    evidenceRoot: "b".repeat(64),
    manifestUrl: "https://example.com/manifest.json"
  };

  await assert.rejects(
    () =>
      generateRealCommandAttestation(input, {
        command: "/usr/local/bin/real-tee",
        runCommand: async () => ({
          stdout: "",
          stderr: "boom",
          exitCode: 1
        })
      }),
    /command attestation backend failed with exit code 1: boom/
  );
});
