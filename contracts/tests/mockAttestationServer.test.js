const assert = require("assert");
const { Readable } = require("stream");

const {
  handleMockAttestationRequest,
  readMockAttestationConfig
} = require("../../infra/polygon-edge-local/scripts/mock-attestation-server.js");

function createResponseDouble() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = typeof body === "string" ? body : body?.toString("utf8") ?? "";
    },
    get jsonBody() {
      return this.body ? JSON.parse(this.body) : null;
    }
  };
}

function createRequestDouble({ method, url, headers = {}, body = "" }) {
  const request = Readable.from([Buffer.from(body)]);
  request.method = method;
  request.url = url;
  request.headers = headers;
  return request;
}

describe("mock attestation server", function () {
  it("reads required config from environment", function () {
    assert.deepStrictEqual(
      readMockAttestationConfig({
        MOCK_ATTESTATION_HOST: "127.0.0.1",
        MOCK_ATTESTATION_PORT: "3315",
        MOCK_ATTESTATION_PROVIDER_TYPE: "nitro-enclave",
        MOCK_ATTESTATION_MEASUREMENT: "m".repeat(64),
        MOCK_ATTESTATION_QUOTE_FORMAT: "nitro"
      }),
      {
        host: "127.0.0.1",
        port: 3315,
        providerType: "nitro-enclave",
        measurement: "m".repeat(64),
        quoteFormat: "nitro",
        sessionPublicKey: "mock-session-public-key",
        quote: "mock-attestation-quote"
      }
    );
  });

  it("returns a structured attestation payload for POST /attest", async function () {
    const response = createResponseDouble();
    await handleMockAttestationRequest(
      createRequestDouble({
        method: "POST",
        url: "/attest",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          eventKey: "0xabc:0",
          tokenId: "1",
          manifestHash: "a".repeat(64),
          evidenceRoot: "e".repeat(64)
        })
      }),
      response,
      {
        host: "127.0.0.1",
        port: 3315,
        providerType: "nitro-enclave",
        measurement: "m".repeat(64),
        quoteFormat: "nitro",
        sessionPublicKey: "mock-session-public-key",
        quote: "mock-attestation-quote"
      }
    );

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.jsonBody, {
      measurement: "m".repeat(64),
      quoteFormat: "nitro",
      sessionPublicKey: "mock-session-public-key",
      quote: "mock-attestation-quote"
    });
  });
});
