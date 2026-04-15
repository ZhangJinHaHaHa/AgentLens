import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";

import {
  handleReportGatewayRequest
} from "../../src/report/reportGatewayServer";
import type { ReportGatewayConfig } from "../../src/report/readReportGatewayConfig";

const baseConfig: ReportGatewayConfig = {
  host: "127.0.0.1",
  port: 3101,
  upstreamBaseUrl: "https://gateway.example/ipfs/",
  fetchTimeoutMs: 15000
};
const validReportCid = "QmYwAPJzv5CZsnAzt8auVTLN9uWw6tG6PvxBUw9u5VnXNf";

test("handleReportGatewayRequest returns health status", async () => {
  const response = createResponseDouble();

  await handleReportGatewayRequest(
    createRequestDouble("GET", "/health"),
    response,
    baseConfig
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody, { status: "ok" });
  assert.equal(response.headers["access-control-allow-origin"], "*");
});

test("handleReportGatewayRequest proxies one report CID from the configured upstream", async () => {
  const response = createResponseDouble();
  const fetchCalls: Array<{ url: string; headers?: HeadersInit }> = [];

  await handleReportGatewayRequest(
    createRequestDouble("GET", `/reports/${validReportCid}`),
    response,
    {
      ...baseConfig,
      authToken: "token-123"
    },
    (async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({
        url: String(url),
        headers: init?.headers
      });

      return new Response('{"hello":"world"}', {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }) as typeof fetch
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/json");
  assert.equal(response.headers["access-control-allow-origin"], "*");
  assert.equal(response.body, '{"hello":"world"}');
  assert.deepEqual(fetchCalls, [
    {
      url: `https://gateway.example/ipfs/${validReportCid}`,
      headers: {
        Authorization: "Bearer token-123"
      }
    }
  ]);
});

test("handleReportGatewayRequest rejects invalid CIDs before contacting the upstream", async () => {
  const response = createResponseDouble();
  let fetchCalls = 0;

  await handleReportGatewayRequest(
    createRequestDouble("GET", "/reports/not-a-cid"),
    response,
    baseConfig,
    async () => {
      fetchCalls += 1;
      return new Response("", { status: 500 });
    }
  );

  assert.equal(fetchCalls, 0);
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.jsonBody, {
    error: "reportCID must be a valid IPFS CID."
  });
  assert.equal(response.headers["access-control-allow-origin"], "*");
});

test("handleReportGatewayRequest returns 404 when the upstream report is missing", async () => {
  const response = createResponseDouble();

  await handleReportGatewayRequest(
    createRequestDouble("GET", `/reports/${validReportCid}`),
    response,
    baseConfig,
    async () => new Response("missing", { status: 404 })
  );

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.jsonBody, {
    error: "Detailed audit report was not found in the upstream gateway.",
    sourceUrl: `https://gateway.example/ipfs/${validReportCid}`
  });
  assert.equal(response.headers["access-control-allow-origin"], "*");
});

test("handleReportGatewayRequest returns 502 when upstream fetch fails", async () => {
  const response = createResponseDouble();

  await handleReportGatewayRequest(
    createRequestDouble("GET", `/reports/${validReportCid}`),
    response,
    baseConfig,
    async () => {
      throw new Error("socket hang up");
    }
  );

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.jsonBody, {
    error: "Failed to fetch the detailed audit report from the upstream gateway.",
    sourceUrl: `https://gateway.example/ipfs/${validReportCid}`
  });
  assert.equal(response.headers["access-control-allow-origin"], "*");
});

test("handleReportGatewayRequest answers CORS preflight requests", async () => {
  const response = createResponseDouble();

  await handleReportGatewayRequest(
    createRequestDouble("OPTIONS", `/reports/${validReportCid}`),
    response,
    baseConfig
  );

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], "*");
  assert.equal(response.headers["access-control-allow-methods"], "GET,OPTIONS");
  assert.equal(response.headers["access-control-allow-headers"], "Content-Type,Authorization");
});

function createRequestDouble(method: string, url: string): AsyncIterable<Buffer | string> & {
  method: string;
  url: string;
} {
  const stream = Readable.from([]);
  return Object.assign(stream, { method, url });
}

function createResponseDouble(): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  jsonBody: unknown;
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
