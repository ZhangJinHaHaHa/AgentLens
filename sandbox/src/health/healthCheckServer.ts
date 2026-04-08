import { createServer, type Server } from "node:http";

import type {
  HealthCheckConfig,
  HealthStatus,
  ReadinessCheckResult,
  ReadinessStatus
} from "./healthCheckTypes";

export interface HealthCheckRequestLike {
  method?: string;
  url?: string;
}

export interface HealthCheckResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

export type HealthCheckRequestHandler = typeof handleHealthCheckRequest;

export function createHealthCheckServer(config: HealthCheckConfig): Server {
  return createServer((request, response) =>
    void handleHealthCheckRequest(request, response, config)
  );
}

export async function handleHealthCheckRequest(
  request: HealthCheckRequestLike,
  response: HealthCheckResponseLike,
  config: HealthCheckConfig
): Promise<void> {
  if (request.method === "GET" && request.url === "/health") {
    const now = config.now ?? Date.now;
    const uptime = now() - config.startedAt;
    const status: HealthStatus = {
      status: "ok",
      service: config.service,
      uptime,
      version: config.version
    };
    writeJson(response, 200, status);
    return;
  }

  if (request.method === "GET" && request.url === "/health/live") {
    writeJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && request.url === "/health/ready") {
    const readinessStatus = await evaluateReadiness(config);
    const statusCode = readinessStatus.ready ? 200 : 503;
    writeJson(response, statusCode, readinessStatus);
    return;
  }

  writeJson(response, 404, { error: "not found" });
}

async function evaluateReadiness(
  config: HealthCheckConfig
): Promise<ReadinessStatus> {
  const results: ReadinessCheckResult[] = [];

  for (const check of config.readinessChecks) {
    try {
      const result = await check.check();
      results.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        name: check.name,
        ok: false,
        message,
        durationMs: 0
      });
    }
  }

  const ready = results.every((r) => r.ok);

  return { ready, checks: results };
}

function writeJson(
  response: HealthCheckResponseLike,
  statusCode: number,
  body: unknown
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}
