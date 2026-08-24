/**
 * 健康 HTTP 层区分基础信息、存活与就绪三个端点，并把所有依赖检查汇总为 200/503；不启动监听端口、不采集指标，也不尝试修复依赖。
 * request method/url 是网络输入，response JSON 是公开运维合同；/health/live 只证明事件循环可响应，不能替代 /health/ready 的外部依赖判定。
 * readiness 检查按配置顺序串行执行，单项抛错会被隔离成失败记录，所有检查都成功才 ready；未知路由稳定返回 JSON 404。
 * 服务器本身不提供认证、限流、超时或缓存，部署时应按暴露范围设置网络边界；并发请求各自执行完整检查，可能同时访问同一 RPC/磁盘资源。
 */
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
