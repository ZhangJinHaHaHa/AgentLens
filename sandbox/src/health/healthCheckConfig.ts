/**
 * 健康配置层把 AUDIT_HEALTH_* 环境值解析为监听配置，并将服务身份、依赖检查与时钟装配为 server 可消费对象；不创建套接字或运行检查。
 * env 是不可信配置边界，输出端口必须是 0..65535 的安全整数；显式健康端口或 metrics 开关会启用同一观测服务，这是现有部署兼容语义。
 * 非数字或越界端口必须在启动副作用前抛错，host 字符串保持原样交由 Node bind 校验；startedAt/now 只用于计算进程内 uptime。
 * 返回值不持有可变模块状态，readinessChecks 的执行次序由调用者传入顺序决定，构建阶段不会探测网络或文件。
 */
import type { HealthCheckConfig, ReadinessCheck } from "./healthCheckTypes";

export interface HealthCheckEnvConfig {
  readonly port: number;
  readonly host: string;
  readonly enabled: boolean;
}

export function readHealthCheckConfigFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): HealthCheckEnvConfig {
  const portRaw = env.AUDIT_HEALTH_PORT;
  const enabled = env.AUDIT_METRICS_ENABLED === "true" || portRaw !== undefined;
  const host = env.AUDIT_HEALTH_HOST ?? "0.0.0.0";

  let port = 9090;
  if (portRaw !== undefined) {
    if (!/^\d+$/.test(portRaw)) {
      throw new Error("AUDIT_HEALTH_PORT must be a non-negative integer.");
    }

    port = Number(portRaw);
    if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
      throw new Error("AUDIT_HEALTH_PORT must be between 0 and 65535.");
    }
  }

  return { port, host, enabled };
}

export function buildHealthCheckConfig(options: {
  service: string;
  version: string;
  envConfig: HealthCheckEnvConfig;
  readinessChecks: readonly ReadinessCheck[];
  startedAt: number;
  now?: () => number;
}): HealthCheckConfig {
  return {
    service: options.service,
    version: options.version,
    port: options.envConfig.port,
    host: options.envConfig.host,
    readinessChecks: options.readinessChecks,
    startedAt: options.startedAt,
    now: options.now
  };
}
