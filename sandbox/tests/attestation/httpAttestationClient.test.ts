import test from "node:test";
import assert from "node:assert/strict";

import { createHttpAttestationClient } from "../../src/attestation/httpAttestationClient";

interface CapturedRequest {
  input: RequestInfo | URL;
  init?: RequestInit;
}

function buildMockFetch(responseBody: unknown, captured: CapturedRequest[]): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    captured.push({ input, init });
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
}

test("createHttpAttestationClient posts evidence inputs and builds an attestation artifact", async () => {
  const captured: CapturedRequest[] = [];
  const client = createHttpAttestationClient({
    apiUrl: "https://tee.example/attest",
    authToken: "token-123",
    providerType: "nitro-enclave",
    timeoutMs: 2500,
    fetchImpl: buildMockFetch(
      {
        measurement: "m".repeat(64),
        quoteFormat: "nitro",
        sessionPublicKey: "spk-123",
        quote: "quote-abc"
      },
      captured
    )
  });

  const result = await client.createAuditAttestation({
    event: {
      eventKey: "0xabc:0",
      tokenId: 1n,
      developer: "0xdev",
      agentName: "risk-agent",
      manifestUrl: "https://example.com/manifest.json",
      blockNumber: 123,
      transactionHash: "0xabc"
    },
    manifestHash: "a".repeat(64),
    evidenceRoot: "e".repeat(64)
  });

  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.input, "https://tee.example/attest");
  assert.equal(captured[0]?.init?.method, "POST");
  assert.equal(
    (captured[0]?.init?.headers as Record<string, string> | undefined)?.Authorization,
    "Bearer token-123"
  );
  assert.equal(result.bundle.verifier.type, "nitro-enclave");
  assert.equal(result.bundle.evidenceRoot, "e".repeat(64));
  assert.equal(result.attestationHash.length, 64);
});

test("createHttpAttestationClient rejects incomplete response payloads", async () => {
  const client = createHttpAttestationClient({
    apiUrl: "https://tee.example/attest",
    providerType: "http-tee",
    timeoutMs: 2500,
    fetchImpl: buildMockFetch(
      {
        measurement: "m".repeat(64),
        quoteFormat: "nitro",
        sessionPublicKey: ""
      },
      []
    )
  });

  await assert.rejects(
    () =>
      client.createAuditAttestation({
        event: {
          eventKey: "0xabc:0",
          tokenId: 1n,
          developer: "0xdev",
          agentName: "risk-agent",
          manifestUrl: "https://example.com/manifest.json",
          blockNumber: 123,
          transactionHash: "0xabc"
        },
        manifestHash: "a".repeat(64),
        evidenceRoot: "e".repeat(64)
      }),
    /sessionPublicKey is required/
  );
});
