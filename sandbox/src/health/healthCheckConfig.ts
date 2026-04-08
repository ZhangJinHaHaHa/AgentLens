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
