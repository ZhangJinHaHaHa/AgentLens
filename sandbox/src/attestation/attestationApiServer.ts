/**
 * 这是审计证明服务的 HTTP 入口：把健康检查和经过鉴权的 v1 证明请求转交给选定的 TEE provider。
 * 方法、路径、请求头与 JSON 正文都来自进程外部；本层只接受约定的版本和必填字符串，并在配置了令牌时执行相等性校验。
 * provider 的返回值会直接序列化为响应，quote 的真实性由 provider/validator 负责；TLS、限流、正文大小和上游身份治理不属于此服务器。
 * `/health` 不触发证明生成，`/attest` 也绝不能在鉴权或内容类型检查失败后调用 provider，这是路由必须保持的副作用边界。
 * 解析和 provider 故障统一成为 400，未知路由成为 404；模块自身不持久化状态，因此没有可回滚写入，provider 已发生的外部副作用则不在其控制范围内。
 */
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
  config: AttestationServiceConfig,
  provider: TeeProvider
): Promise<void> {
  if (request.method === "GET" && request.url === "/health") {
    writeJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "POST" && request.url === "/attest") {
    if (!isAuthorizedAttestationRequest(request, config)) {
      writeJson(response, 401, { error: "Attestation API authorization is required." });
      return;
    }

    const contentType = readHeader(request, "content-type");
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

function isAuthorizedAttestationRequest(
  request: AttestationApiRequestLike,
  config: AttestationServiceConfig
): boolean {
  if (!config.authToken) {
    return true;
  }
  const provided =
    readBearerToken(readHeader(request, "authorization")) ??
    readHeader(request, "x-agentlens-attestation-token");
  return provided === config.authToken;
}

function readHeader(request: AttestationApiRequestLike, name: string): string | undefined {
  const headers = request.headers;
  if (!headers) return undefined;
  const normalized = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === normalized) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return undefined;
}

function readBearerToken(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() || undefined;
}
