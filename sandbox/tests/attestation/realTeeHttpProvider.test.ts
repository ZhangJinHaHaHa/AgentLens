import test from "node:test";
import assert from "node:assert/strict";

import { createExpectedAttestationQuoteValidator } from "../../src/attestation/attestationQuoteValidator";
import { createRealTeeHttpProvider } from "../../src/attestation/realTeeHttpProvider";

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

test("createRealTeeHttpProvider posts one attestation request to the backend and validates the response", async () => {
  const captured: CapturedRequest[] = [];
  const provider = createRealTeeHttpProvider({
    backendUrl: "https://tee-backend.example/quote",
    authToken: "token-123",
    providerType: "nitro-enclave",
    timeoutMs: 2500,
    quoteValidator: createExpectedAttestationQuoteValidator({
      expectedProviderType: "nitro-enclave",
      expectedMeasurement: "m".repeat(64),
      expectedQuoteFormat: "nitro"
    }),
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

  const result = await provider.attest({
    schemaVersion: "audit-attestation-request.v1",
    eventKey: "0xabc:0",
    tokenId: "1",
    manifestHash: "a".repeat(64),
    evidenceRoot: "e".repeat(64),
    manifestUrl: "https://example.com/manifest.json"
  });

  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.input, "https://tee-backend.example/quote");
  assert.equal(captured[0]?.init?.method, "POST");
  assert.equal(
    (captured[0]?.init?.headers as Record<string, string> | undefined)?.Authorization,
    "Bearer token-123"
  );
  assert.deepEqual(result, {
    measurement: "m".repeat(64),
    quoteFormat: "nitro",
    sessionPublicKey: "spk-123",
    quote: "quote-abc"
  });
});

test("createRealTeeHttpProvider surfaces validator failures", async () => {
  const provider = createRealTeeHttpProvider({
    backendUrl: "https://tee-backend.example/quote",
    providerType: "nitro-enclave",
    timeoutMs: 2500,
    quoteValidator: createExpectedAttestationQuoteValidator({
      expectedProviderType: "nitro-enclave",
      expectedMeasurement: "a".repeat(64)
    }),
    fetchImpl: buildMockFetch(
      {
        measurement: "b".repeat(64),
        quoteFormat: "nitro",
        sessionPublicKey: "spk-123",
        quote: "quote-abc"
      },
      []
    )
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
    /measurement does not match expected value/
  );
});

test("createRealTeeHttpProvider preserves typed validator errors", async () => {
  const provider = createRealTeeHttpProvider({
    backendUrl: "https://tee-backend.example/quote",
    providerType: "nitro-enclave",
    timeoutMs: 2500,
    quoteValidator: createExpectedAttestationQuoteValidator({
      expectedQuoteFormat: "nitro"
    }),
    fetchImpl: buildMockFetch(
      {
        measurement: "a".repeat(64),
        quoteFormat: "mock-quote",
        sessionPublicKey: "spk-123",
        quote: "quote-abc"
      },
      []
    )
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
    (error) => {
      assert.equal((error as { code?: string }).code, "QUOTE_FORMAT_MISMATCH");
      return true;
    }
  );
});
