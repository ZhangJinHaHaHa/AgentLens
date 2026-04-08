import type { ReadinessCheck } from "./healthCheckTypes";
import { readHealthCheckConfigFromEnv, buildHealthCheckConfig } from "./healthCheckConfig";
import { startObservabilityServer, type StartedObservabilityServer } from "./observabilityServer";
import { createMetricsCollector, type MetricsCollector } from "../metrics/metricsCollector";
import { createRpcCheck, createDiskWritableCheck } from "./dependencyChecker";
import { writeFile, unlink } from "node:fs/promises";

const SERVICE_NAME = "listener";
const SERVICE_VERSION = "0.1.0";

export interface ListenerHealthIntegration {
  readonly getMetrics: () => MetricsCollector;
  readonly updateMetrics: (updater: (current: MetricsCollector) => MetricsCollector) => void;
  readonly server: StartedObservabilityServer | undefined;
  readonly stop: () => Promise<void>;
}

export interface ListenerHealthIntegrationOptions {
  readonly env: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly rpcUrl?: string;
  readonly stateDir?: string;
  readonly fetchImpl?: typeof fetch;
}

export async function createListenerHealthIntegration(
  options: ListenerHealthIntegrationOptions
): Promise<ListenerHealthIntegration> {
  const envConfig = readHealthCheckConfigFromEnv(options.env);

  let currentMetrics = createMetricsCollector();

  const getMetrics = (): MetricsCollector => currentMetrics;
  const updateMetrics = (updater: (current: MetricsCollector) => MetricsCollector): void => {
    currentMetrics = updater(currentMetrics);
  };

  if (!envConfig.enabled) {
    return {
      getMetrics,
      updateMetrics,
      server: undefined,
      stop: async () => {}
    };
  }

  const readinessChecks: ReadinessCheck[] = [];

  if (options.rpcUrl) {
    readinessChecks.push(
      createRpcCheck(options.rpcUrl, options.fetchImpl)
    );
  }

  if (options.stateDir) {
    readinessChecks.push(
      createDiskWritableCheck(options.stateDir, {
        writeFile: (path, data) => writeFile(path, data, "utf8"),
        unlink: (path) => unlink(path)
      })
    );
  }

  const healthConfig = buildHealthCheckConfig({
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    envConfig,
    readinessChecks,
    startedAt: Date.now()
  });

  const server = await startObservabilityServer({
    healthConfig,
    getMetrics
  });

  return {
    getMetrics,
    updateMetrics,
    server,
    stop: async () => {
      await server.close();
    }
  };
}
