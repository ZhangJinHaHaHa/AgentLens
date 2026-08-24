/**
 * 此 HTTP server 在同一监听面上路由健康、指标和基于当前快照计算的告警结果，并封装 bind/close 生命周期；不持久化指标或向外部告警系统推送通知。
 * 请求路径来自网络，healthConfig 与 getMetrics 来自进程内所有者，JSON 响应是运维消费者接口；本层没有认证、TLS 或访问控制，暴露范围由部署网络决定。
 * /alerts 必须针对一次 snapshot 同时计算规则和 evaluatedAt，避免混合不同时刻；未知路径返回 JSON 404，bind 与 close 错误通过 Promise 传播。
 * Node 可并发接收请求，健康检查含异步 I/O 而指标/告警读取当前不可变 collector；关闭只停止接受新连接，不代表外部依赖或主 listener 已停止。
 */
import { createServer, type Server } from "node:http";

import type { HealthCheckConfig } from "./healthCheckTypes";
import { handleHealthCheckRequest } from "./healthCheckServer";
import {
  handleMetricsRequest,
  type MetricsCollector
} from "../metrics/metricsCollector";
import { evaluateAllRules } from "../metrics/alertRules";

export interface ObservabilityServerOptions {
  readonly healthConfig: HealthCheckConfig;
  readonly getMetrics: () => MetricsCollector;
}

export function createObservabilityServer(
  options: ObservabilityServerOptions
): Server {
  return createServer((request, response) => {
    const url = request.url ?? "";

    if (url.startsWith("/health")) {
      void handleHealthCheckRequest(request, response, options.healthConfig);
      return;
    }

    if (url === "/metrics") {
      handleMetricsRequest(request, response, options.getMetrics());
      return;
    }

    if (url === "/alerts") {
      const metrics = options.getMetrics();
      const snapshot = metrics.snapshot();
      const results = evaluateAllRules(snapshot);

      response.statusCode = 200;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({
        alerts: results,
        evaluatedAt: snapshot.collectedAt
      }));
      return;
    }

    response.statusCode = 404;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ error: "not found" }));
  });
}

export interface StartedObservabilityServer {
  readonly server: Server;
  readonly port: number;
  readonly host: string;
  readonly close: () => Promise<void>;
}

export async function startObservabilityServer(
  options: ObservabilityServerOptions
): Promise<StartedObservabilityServer> {
  const server = createObservabilityServer(options);
  const { port, host } = options.healthConfig;

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      resolve();
    });
  });

  return {
    server,
    port,
    host,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      })
  };
}
