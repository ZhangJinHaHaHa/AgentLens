/**
 * listener 观测集成拥有进程内指标快照，并按环境选择性启动聚合健康/指标服务器；不修改监听主循环逻辑，也不替它判断审计或链回写成功。
 * env、RPC URL 与 stateDir 决定外部 readiness 边界，输出提供 get/update、可选 server 和幂等调用方应管理的 stop 生命周期。
 * 启用时会绑定网络端口、探测 RPC 并在状态目录创建短暂文件；禁用时仍提供纯内存指标收集，但不得伪装存在监听服务。
 * 指标更新采用“传入当前 collector、替换为新 collector”的单进程所有权模型；调用者应串行更新以避免基于陈旧快照丢增量，关闭时必须等待 server.close 完成。
 */
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
