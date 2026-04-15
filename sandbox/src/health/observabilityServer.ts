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
