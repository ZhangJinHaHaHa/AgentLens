export interface Counter {
  readonly name: string;
  readonly value: number;
}

export interface Gauge {
  readonly name: string;
  readonly value: number;
}

export interface MetricsSnapshot {
  readonly counters: readonly Counter[];
  readonly gauges: readonly Gauge[];
  readonly collectedAt: string;
}

export interface AlertResult {
  readonly firing: boolean;
  readonly message: string;
}

export interface AlertRule {
  readonly name: string;
  readonly evaluate: (metrics: MetricsSnapshot) => AlertResult;
}
