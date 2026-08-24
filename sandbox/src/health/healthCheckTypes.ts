/**
 * 这些类型定义健康、就绪检查和服务配置之间的只读合同，使探针实现与 HTTP 呈现解耦；它们不执行检查，也不保证报告内容可信。
 * uptime 与 durationMs 的单位固定为毫秒，startedAt/now 使用同一时间基准；名称、状态值及 ready 聚合形状属于监控消费者的兼容边界。
 * ReadinessCheck 允许异步 I/O 和失败，服务器必须捕获异常并生成结果；readonly 只限制 TypeScript 写法，不构成跨线程同步或深度不可变保证。
 */
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
