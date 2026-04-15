import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { handleAttestationApiRequest } from "../../src/attestation/attestationApiServer";

const baseConfig = {
  host: "127.0.0.1",
  port: 3311,
  providerMode: "mock" as const
};

test("handleAttestationApiRequest returns health status", async () => {
  const response = createResponseDouble();

  await handleAttestationApiRequest(
    createRequestDouble({ method: "GET", url: "/health" }),
    response,
    baseConfig,
    {
      attest: async () => {
        throw new Error("provider should not be called");
      }
    }
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody, { status: "ok" });
});

test("handleAttestationApiRequest returns canonical attestation response for a valid request", async () => {
  const response = createResponseDouble();

  await handleAttestationApiRequest(
    createRequestDouble({
      method: "POST",
      url: "/attest",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        schemaVersion: "audit-attestation-request.v1",
        eventKey: "0xabc:0",
        tokenId: "1",
        manifestHash: "a".repeat(64),
        evidenceRoot: "e".repeat(64),
        manifestUrl: "https://example.com/manifest.json"
      })
    }),
    response,
    baseConfig,
    {
      attest: async (input) => {
        assert.equal(input.eventKey, "0xabc:0");
        return {
          measurement: "m".repeat(64),
          quoteFormat: "mock-quote",
          sessionPublicKey: "spk-123",
          quote: "quote-abc"
        };
      }
    }
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody, {
    measurement: "m".repeat(64),
    quoteFormat: "mock-quote",
    sessionPublicKey: "spk-123",
    quote: "quote-abc"
  });
});

test("handleAttestationApiRequest rejects invalid bodies", async () => {
  const response = createResponseDouble();

  await handleAttestationApiRequest(
    createRequestDouble({
      method: "POST",
      url: "/attest",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        schemaVersion: "audit-attestation-request.v1",
        eventKey: "0xabc:0"
      })
    }),
    response,
    baseConfig,
    {
      attest: async () => {
        throw new Error("provider should not be called");
      }
    }
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.jsonBody?.error, "tokenId is required");
});

function createRequestDouble({
  method,
  url,
  headers = {},
  body = ""
}: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}) {
  const stream = Readable.from([Buffer.from(body)]);
  return Object.assign(stream, { method, url, headers });
}

function createResponseDouble(): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  jsonBody: any;
  setHeader(name: string, value: string): void;
  end(body: string): void;
} {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    jsonBody: undefined,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body: string) {
      this.body = body;
      try {
        this.jsonBody = JSON.parse(body);
      } catch {
        this.jsonBody = undefined;
      }
    }
  };
}
