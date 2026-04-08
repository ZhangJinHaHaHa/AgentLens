export type HealthStatusValue = "ok" | "degraded" | "unhealthy";

export interface HealthStatus {
  readonly status: HealthStatusValue;
  readonly service: string;
  readonly uptime: number;
  readonly version: string;
}

export interface ReadinessCheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly message: string;
  readonly durationMs: number;
}

export interface ReadinessStatus {
  readonly ready: boolean;
  readonly checks: readonly ReadinessCheckResult[];
}

export interface ReadinessCheck {
  readonly name: string;
  readonly check: () => Promise<ReadinessCheckResult>;
}

export interface HealthCheckConfig {
  readonly service: string;
  readonly version: string;
  readonly port: number;
  readonly host: string;
  readonly readinessChecks: readonly ReadinessCheck[];
  readonly startedAt: number;
  readonly now?: () => number;
}
