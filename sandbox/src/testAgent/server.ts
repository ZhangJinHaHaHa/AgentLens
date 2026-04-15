import { createServer } from "node:http";

import { PORT } from "../config/constants";
import { buildHealthResponse, buildSolveResponse } from "./response";
import type { AuditSolveRequest } from "../types/manifest";

function writeJson(response: import("node:http").ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(`${JSON.stringify(body)}\n`);
}

async function readJsonBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody.length > 0 ? JSON.parse(rawBody) : {};
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/audit/health") {
    writeJson(response, 200, buildHealthResponse());
    return;
  }

  if (request.method === "POST" && request.url === "/audit/solve") {
    try {
      const payload = (await readJsonBody(request)) as AuditSolveRequest;
      writeJson(response, 200, buildSolveResponse(payload));
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : "invalid request"
      });
    }

    return;
  }

  writeJson(response, 404, { error: "not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  process.stdout.write(`test-agent listening on ${PORT}\n`);
});
