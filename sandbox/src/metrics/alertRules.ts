import type { AlertResult, AlertRule, MetricsSnapshot } from "./metricsTypes";

function findCounterValue(metrics: MetricsSnapshot, name: string): number {
  const counter = metrics.counters.find((c) => c.name === name);
  return counter?.value ?? 0;
}

function findGaugeValue(metrics: MetricsSnapshot, name: string): number {
  const gauge = metrics.gauges.find((g) => g.name === name);
  return gauge?.value ?? 0;
}

export const highFailureRateRule: AlertRule = {
  name: "high_failure_rate",
  evaluate(metrics: MetricsSnapshot): AlertResult {
    const total = findCounterValue(metrics, "audits_total");
    const failed = findCounterValue(metrics, "audits_failed");

    if (total === 0) {
      return {
        firing: false,
        message: "No audits recorded yet."
      };
    }

    const failureRate = failed / total;
    if (failureRate > 0.5) {
      return {
        firing: true,
        message: `High failure rate: ${(failureRate * 100).toFixed(1)}% (${failed}/${total} audits failed).`
      };
    }

    return {
      firing: false,
      message: `Failure rate is ${(failureRate * 100).toFixed(1)}% (${failed}/${total}).`
    };
  }
};

export const blockLagHighRule: AlertRule = {
  name: "block_lag_high",
  evaluate(metrics: MetricsSnapshot): AlertResult {
    const lag = findGaugeValue(metrics, "current_block_lag");

    if (lag > 100) {
      return {
        firing: true,
        message: `Block lag is ${lag}, which exceeds the threshold of 100.`
      };
    }

    return {
      firing: false,
      message: `Block lag is ${lag}.`
    };
  }
};

export const writebackFailuresRule: AlertRule = {
  name: "writeback_failures",
  evaluate(metrics: MetricsSnapshot): AlertResult {
    const consecutiveFailures = findGaugeValue(metrics, "consecutive_writeback_failures");

    if (consecutiveFailures > 3) {
      return {
        firing: true,
        message: `${consecutiveFailures} consecutive writeback failures detected (threshold: 3).`
      };
    }

    return {
      firing: false,
      message: `Consecutive writeback failures: ${consecutiveFailures}.`
    };
  }
};

export const diskSpaceLowRule: AlertRule = {
  name: "disk_space_low",
  evaluate(metrics: MetricsSnapshot): AlertResult {
    const usagePercent = findGaugeValue(metrics, "disk_usage_percent");

    if (usagePercent > 90) {
      return {
        firing: true,
        message: `Disk usage is ${usagePercent}%, which exceeds the 90% threshold.`
      };
    }

    return {
      firing: false,
      message: `Disk usage is ${usagePercent}%.`
    };
  }
};

const ALL_RULES: readonly AlertRule[] = [
  highFailureRateRule,
  blockLagHighRule,
  writebackFailuresRule,
  diskSpaceLowRule
];

export interface EvaluatedAlertRule {
  readonly name: string;
  readonly result: AlertResult;
}

export function evaluateAllRules(
  metrics: MetricsSnapshot
): readonly EvaluatedAlertRule[] {
  return ALL_RULES.map((rule) => ({
    name: rule.name,
    result: rule.evaluate(metrics)
  }));
}
