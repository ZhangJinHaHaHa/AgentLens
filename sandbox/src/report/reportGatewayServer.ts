import { createServer, type Server } from "node:http";

import CID from "cids";

import type { ReportGatewayConfig } from "./readReportGatewayConfig";

interface ReportGatewayRequestLike extends AsyncIterable<Buffer | string> {
  method?: string;
  url?: string;
}

interface ReportGatewayResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

export function createReportGatewayServer(
  config: ReportGatewayConfig,
  fetchImpl: typeof fetch = fetch
): Server {
  return createServer((request, response) =>
    void handleReportGatewayRequest(request, response, config, fetchImpl)
  );
}

export async function handleReportGatewayRequest(
  request: ReportGatewayRequestLike,
  response: ReportGatewayResponseLike,
  config: ReportGatewayConfig,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end("");
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    writeJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && request.url?.startsWith("/reports/")) {
    const reportCID = decodeURIComponent(request.url.slice("/reports/".length));
    if (!isValidCid(reportCID)) {
      writeJson(response, 400, {
        error: "reportCID must be a valid IPFS CID."
      });
      return;
    }

    const sourceUrl = `${config.upstreamBaseUrl}${encodeURIComponent(reportCID)}`;

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetchImpl(sourceUrl, {
        headers: config.authToken
          ? {
              Authorization: `Bearer ${config.authToken}`
            }
          : undefined,
        signal: AbortSignal.timeout(config.fetchTimeoutMs)
      });
    } catch {
      writeJson(response, 502, {
        error: "Failed to fetch the detailed audit report from the upstream gateway.",
        sourceUrl
      });
      return;
    }

    if (upstreamResponse.status === 404) {
      writeJson(response, 404, {
        error: "Detailed audit report was not found in the upstream gateway.",
        sourceUrl
      });
      return;
    }

    if (!upstreamResponse.ok) {
      writeJson(response, 502, {
        error: `Upstream gateway responded with status ${upstreamResponse.status}.`,
        sourceUrl
      });
      return;
    }

    response.statusCode = 200;
    response.setHeader(
      "Content-Type",
      upstreamResponse.headers.get("content-type") || "application/json"
    );
    response.end(await upstreamResponse.text());
    return;
  }

  writeJson(response, 404, { error: "not found" });
}

function isValidCid(value: string): boolean {
  if (value.trim() === "") {
    return false;
  }

  try {
    new CID(value);
    return true;
  } catch {
    return false;
  }
}

function writeJson(
  response: ReportGatewayResponseLike,
  statusCode: number,
  body: unknown
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

function setCorsHeaders(response: ReportGatewayResponseLike): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}
