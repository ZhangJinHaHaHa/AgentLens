/**
 * 指标收集器维护一组封闭名称的进程内 counter/gauge，并能生成带采集时间的不可变快照或响应 /metrics；不落盘、不聚合多进程，也不计算告警。
 * 更新方法输入受类型约束的名称与数值，输出新的 MetricsCollector 而非原地修改；调用方必须保存返回实例，否则该次更新会被有意丢弃。
 * HTTP 请求属于网络边界，只有精确 GET /metrics 才暴露 JSON 快照，其余返回 404；快照数据是观测信息而非业务事实来源。
 * 持久 Map 的复制模型避免读者看到半次更新，但并发基于同一旧实例派生仍会发生最后写入覆盖；所有者需在单一事件序列中协调替换。
 */
import type { Counter, Gauge, MetricsSnapshot } from "./metricsTypes";

const KNOWN_COUNTERS = [
  "audits_total",
  "audits_passed",
  "audits_failed",
  "slashes_total",
  "writebacks_total",
  "writebacks_failed"
] as const;

const KNOWN_GAUGES = [
  "audit_duration_ms",
  "current_block_lag",
  "consecutive_writeback_failures",
  "disk_usage_percent"
] as const;

export type KnownCounterName = (typeof KNOWN_COUNTERS)[number];
export type KnownGaugeName = (typeof KNOWN_GAUGES)[number];

export interface MetricsCollector {
  readonly incrementCounter: (name: KnownCounterName) => MetricsCollector;
  readonly incrementCounterBy: (name: KnownCounterName, delta: number) => MetricsCollector;
  readonly setGauge: (name: KnownGaugeName, value: number) => MetricsCollector;
  readonly recordDuration: (name: KnownGaugeName, durationMs: number) => MetricsCollector;
  readonly snapshot: () => MetricsSnapshot;
}

export interface MetricsCollectorOptions {
  readonly now?: () => Date;
}

export interface MetricsRequestLike {
  method?: string;
  url?: string;
}

export interface MetricsResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

function buildInitialCounters(): ReadonlyMap<string, number> {
  const entries: Array<[string, number]> = KNOWN_COUNTERS.map((name) => [name, 0]);
  return new Map(entries);
}

function buildInitialGauges(): ReadonlyMap<string, number> {
  const entries: Array<[string, number]> = KNOWN_GAUGES.map((name) => [name, 0]);
  return new Map(entries);
}

function createCollectorFromState(
  counters: ReadonlyMap<string, number>,
  gauges: ReadonlyMap<string, number>,
  now: () => Date
): MetricsCollector {
  return {
    incrementCounter(name: KnownCounterName): MetricsCollector {
      const updatedCounters = new Map(counters);
      updatedCounters.set(name, (counters.get(name) ?? 0) + 1);
      return createCollectorFromState(updatedCounters, gauges, now);
    },

    incrementCounterBy(name: KnownCounterName, delta: number): MetricsCollector {
      const updatedCounters = new Map(counters);
      updatedCounters.set(name, (counters.get(name) ?? 0) + delta);
      return createCollectorFromState(updatedCounters, gauges, now);
    },

    setGauge(name: KnownGaugeName, value: number): MetricsCollector {
      const updatedGauges = new Map(gauges);
      updatedGauges.set(name, value);
      return createCollectorFromState(counters, updatedGauges, now);
    },

    recordDuration(name: KnownGaugeName, durationMs: number): MetricsCollector {
      const updatedGauges = new Map(gauges);
      updatedGauges.set(name, durationMs);
      return createCollectorFromState(counters, updatedGauges, now);
    },

    snapshot(): MetricsSnapshot {
      const counterList: Counter[] = Array.from(counters.entries()).map(([name, value]) => ({
        name,
        value
      }));

      const gaugeList: Gauge[] = Array.from(gauges.entries()).map(([name, value]) => ({
        name,
        value
      }));

      return {
        counters: counterList,
        gauges: gaugeList,
        collectedAt: now().toISOString()
      };
    }
  };
}

export function createMetricsCollector(
  options: MetricsCollectorOptions = {}
): MetricsCollector {
  const now = options.now ?? (() => new Date());
  return createCollectorFromState(buildInitialCounters(), buildInitialGauges(), now);
}

export function handleMetricsRequest(
  request: MetricsRequestLike,
  response: MetricsResponseLike,
  collector: MetricsCollector
): void {
  if (request.method === "GET" && request.url === "/metrics") {
    const snapshot = collector.snapshot();
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(snapshot));
    return;
  }

  response.statusCode = 404;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ error: "not found" }));
}
