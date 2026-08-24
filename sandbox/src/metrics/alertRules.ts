/**
 * 告警规则层对单次 MetricsSnapshot 执行确定性阈值判断，覆盖审计失败率、区块滞后、连续回写失败和磁盘占用；不采集指标、不维护时间窗口，也不发送告警。
 * 输入快照可能缺项，兼容行为是按零处理；输出保留规则名、firing 与人类可读说明，阈值和指标键是监控面板可依赖的运行合同。
 * 规则是纯函数且没有 I/O/共享状态，可安全并行评估；累计失败率不代表近期速率，调用方不得把缺失数据或冷启动零值解释成已验证健康。
 * evaluateAllRules 保持固定规则集合与顺序，单个自定义坏值不会在此校正；采集端必须保证数值单位和有限性。
 */
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
