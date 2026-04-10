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
