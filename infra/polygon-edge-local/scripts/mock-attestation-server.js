const http = require("node:http");

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    request.on("error", reject);
  });
}

function writeJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

function readMockAttestationConfig(env = process.env) {
  const measurement = env.MOCK_ATTESTATION_MEASUREMENT;
  if (!measurement) {
    throw new Error("MOCK_ATTESTATION_MEASUREMENT is required");
  }

  return {
    host: env.MOCK_ATTESTATION_HOST || "127.0.0.1",
    port: Number.parseInt(env.MOCK_ATTESTATION_PORT || "3311", 10),
    providerType: env.MOCK_ATTESTATION_PROVIDER_TYPE || "mock-tee",
    measurement,
    quoteFormat: env.MOCK_ATTESTATION_QUOTE_FORMAT || "mock-quote",
    sessionPublicKey: env.MOCK_ATTESTATION_SESSION_PUBLIC_KEY || "mock-session-public-key",
    quote: env.MOCK_ATTESTATION_QUOTE || "mock-attestation-quote"
  };
}

async function handleMockAttestationRequest(request, response, config) {
  try {
    if (request.method === "GET" && request.url === "/health") {
      writeJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "POST" && request.url === "/attest") {
      const contentType = request.headers["content-type"];
      if (typeof contentType !== "string" || !contentType.includes("application/json")) {
        writeJson(response, 400, { error: "application/json content-type is required" });
        return;
      }

      const body = await readRequestBody(request);
      const payload = JSON.parse(body.toString("utf8"));
      if (!payload || typeof payload.evidenceRoot !== "string" || payload.evidenceRoot.length === 0) {
        writeJson(response, 400, { error: "evidenceRoot is required" });
        return;
      }

      writeJson(response, 200, {
        measurement: config.measurement,
        quoteFormat: config.quoteFormat,
        sessionPublicKey: config.sessionPublicKey,
        quote: config.quote
      });
      return;
    }

    writeJson(response, 404, { error: "not found" });
  } catch (error) {
    writeJson(response, 500, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function createMockAttestationServer(config) {
  return http.createServer((request, response) =>
    void handleMockAttestationRequest(request, response, config)
  );
}

module.exports = {
  createMockAttestationServer,
  handleMockAttestationRequest,
  readMockAttestationConfig
};

if (require.main === module) {
  const config = readMockAttestationConfig(process.env);
  const server = createMockAttestationServer(config);

  server.listen(config.port, config.host, () => {
    process.stdout.write(
      `${JSON.stringify({
        type: "mock-attestation-listening",
        host: config.host,
        port: config.port,
        providerType: config.providerType
      })}\n`
    );
  });
}
