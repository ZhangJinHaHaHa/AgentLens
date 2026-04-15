import { createServer, type Server } from "node:http";

import type { AttestationRequest, TeeProvider } from "./mockTeeProvider";
import type { AttestationServiceConfig } from "./readAttestationServiceConfig";

interface AttestationApiRequestLike extends AsyncIterable<Buffer | string> {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface AttestationApiResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

async function readRequestBody(request: AsyncIterable<Buffer | string>): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function writeJson(response: AttestationApiResponseLike, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

function requireString(value: unknown, field: keyof AttestationRequest): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }

  return value;
}

function parseAttestationRequest(bodyText: string): AttestationRequest {
  const parsed = JSON.parse(bodyText) as Partial<AttestationRequest>;

  if (parsed.schemaVersion !== "audit-attestation-request.v1") {
    throw new Error("schemaVersion must be audit-attestation-request.v1");
  }

  return {
    schemaVersion: "audit-attestation-request.v1",
    eventKey: requireString(parsed.eventKey, "eventKey"),
    tokenId: requireString(parsed.tokenId, "tokenId"),
    manifestHash: requireString(parsed.manifestHash, "manifestHash"),
    evidenceRoot: requireString(parsed.evidenceRoot, "evidenceRoot"),
    manifestUrl: requireString(parsed.manifestUrl, "manifestUrl")
  };
}

export function createAttestationApiServer(
  config: AttestationServiceConfig,
  provider: TeeProvider
): Server {
  return createServer((request, response) =>
    void handleAttestationApiRequest(request, response, config, provider)
  );
}

export async function handleAttestationApiRequest(
  request: AttestationApiRequestLike,
  response: AttestationApiResponseLike,
  _config: AttestationServiceConfig,
  provider: TeeProvider
): Promise<void> {
  if (request.method === "GET" && request.url === "/health") {
    writeJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "POST" && request.url === "/attest") {
    const contentType = request.headers?.["content-type"];
    if (typeof contentType !== "string" || !contentType.includes("application/json")) {
      writeJson(response, 400, { error: "application/json content-type is required" });
      return;
    }

    try {
      const input = parseAttestationRequest(await readRequestBody(request));
      const result = await provider.attest(input);
      writeJson(response, 200, result);
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    return;
  }

  writeJson(response, 404, { error: "not found" });
}
