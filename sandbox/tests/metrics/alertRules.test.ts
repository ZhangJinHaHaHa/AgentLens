import assert from "node:assert/strict";
import test from "node:test";

import {
  highFailureRateRule,
  blockLagHighRule,
  writebackFailuresRule,
  diskSpaceLowRule,
  evaluateAllRules
} from "../../src/metrics/alertRules";
import type { MetricsSnapshot } from "../../src/metrics/metricsTypes";

function createSnapshot(overrides: {
  counters?: Array<{ name: string; value: number }>;
  gauges?: Array<{ name: string; value: number }>;
} = {}): MetricsSnapshot {
  return {
    counters: overrides.counters ?? [],
    gauges: overrides.gauges ?? [],
    collectedAt: "2026-04-11T00:00:00.000Z"
  };
}

// ---------- high_failure_rate ----------

test("highFailureRateRule fires when failure rate exceeds 50%", () => {
  const snapshot = createSnapshot({
    counters: [
      { name: "audits_total", value: 10 },
      { name: "audits_failed", value: 6 }
    ]
  });

  const result = highFailureRateRule.evaluate(snapshot);
  assert.equal(result.firing, true);
  assert.match(result.message, /failure rate/i);
});

test("highFailureRateRule does not fire when failure rate is 50%", () => {
  const snapshot = createSnapshot({
    counters: [
      { name: "audits_total", value: 10 },
      { name: "audits_failed", value: 5 }
    ]
  });

  const result = highFailureRateRule.evaluate(snapshot);
  assert.equal(result.firing, false);
});

test("highFailureRateRule does not fire when no audits exist", () => {
  const snapshot = createSnapshot({
    counters: [
      { name: "audits_total", value: 0 },
      { name: "audits_failed", value: 0 }
    ]
  });

  const result = highFailureRateRule.evaluate(snapshot);
  assert.equal(result.firing, false);
});

test("highFailureRateRule does not fire when failure rate is low", () => {
  const snapshot = createSnapshot({
    counters: [
      { name: "audits_total", value: 100 },
      { name: "audits_failed", value: 10 }
    ]
  });

  const result = highFailureRateRule.evaluate(snapshot);
  assert.equal(result.firing, false);
});

// ---------- block_lag_high ----------

test("blockLagHighRule fires when block lag exceeds 100", () => {
  const snapshot = createSnapshot({
    gauges: [{ name: "current_block_lag", value: 150 }]
  });

  const result = blockLagHighRule.evaluate(snapshot);
  assert.equal(result.firing, true);
  assert.match(result.message, /block lag/i);
});

test("blockLagHighRule does not fire when block lag is 100", () => {
  const snapshot = createSnapshot({
    gauges: [{ name: "current_block_lag", value: 100 }]
  });

  const result = blockLagHighRule.evaluate(snapshot);
  assert.equal(result.firing, false);
});

test("blockLagHighRule does not fire when block lag is 0", () => {
  const snapshot = createSnapshot({
    gauges: [{ name: "current_block_lag", value: 0 }]
  });

  const result = blockLagHighRule.evaluate(snapshot);
  assert.equal(result.firing, false);
});

// ---------- writeback_failures ----------

test("writebackFailuresRule fires when consecutive failures exceed 3", () => {
  const snapshot = createSnapshot({
    gauges: [{ name: "consecutive_writeback_failures", value: 4 }]
  });

  const result = writebackFailuresRule.evaluate(snapshot);
  assert.equal(result.firing, true);
  assert.match(result.message, /writeback/i);
});

test("writebackFailuresRule does not fire when consecutive failures is 3", () => {
  const snapshot = createSnapshot({
    gauges: [{ name: "consecutive_writeback_failures", value: 3 }]
  });

  const result = writebackFailuresRule.evaluate(snapshot);
  assert.equal(result.firing, false);
});

test("writebackFailuresRule does not fire when consecutive failures is 0", () => {
  const snapshot = createSnapshot({
    gauges: [{ name: "consecutive_writeback_failures", value: 0 }]
  });

  const result = writebackFailuresRule.evaluate(snapshot);
  assert.equal(result.firing, false);
});

// ---------- disk_space_low ----------

test("diskSpaceLowRule fires when disk usage exceeds 90%", () => {
  const snapshot = createSnapshot({
    gauges: [{ name: "disk_usage_percent", value: 95 }]
  });

  const result = diskSpaceLowRule.evaluate(snapshot);
  assert.equal(result.firing, true);
  assert.match(result.message, /disk/i);
});

test("diskSpaceLowRule does not fire when disk usage is 90%", () => {
  const snapshot = createSnapshot({
    gauges: [{ name: "disk_usage_percent", value: 90 }]
  });

  const result = diskSpaceLowRule.evaluate(snapshot);
  assert.equal(result.firing, false);
});

test("diskSpaceLowRule does not fire when disk usage is low", () => {
  const snapshot = createSnapshot({
    gauges: [{ name: "disk_usage_percent", value: 30 }]
  });

  const result = diskSpaceLowRule.evaluate(snapshot);
  assert.equal(result.firing, false);
});

// ---------- evaluateAllRules ----------

test("evaluateAllRules returns all rule results", () => {
  const snapshot = createSnapshot({
    counters: [
      { name: "audits_total", value: 10 },
      { name: "audits_failed", value: 8 }
    ],
    gauges: [
      { name: "current_block_lag", value: 200 },
      { name: "consecutive_writeback_failures", value: 5 },
      { name: "disk_usage_percent", value: 95 }
    ]
  });

  const results = evaluateAllRules(snapshot);
  assert.equal(results.length, 4);

  const firingCount = results.filter((r) => r.result.firing).length;
  assert.equal(firingCount, 4);
});

test("evaluateAllRules returns no firing alerts for healthy metrics", () => {
  const snapshot = createSnapshot({
    counters: [
      { name: "audits_total", value: 100 },
      { name: "audits_failed", value: 2 }
    ],
    gauges: [
      { name: "current_block_lag", value: 5 },
      { name: "consecutive_writeback_failures", value: 0 },
      { name: "disk_usage_percent", value: 50 }
    ]
  });

  const results = evaluateAllRules(snapshot);
  const firingCount = results.filter((r) => r.result.firing).length;
  assert.equal(firingCount, 0);
});

test("evaluateAllRules includes rule names in results", () => {
  const snapshot = createSnapshot();
  const results = evaluateAllRules(snapshot);

  const ruleNames = results.map((r) => r.name);
  assert.ok(ruleNames.includes("high_failure_rate"));
  assert.ok(ruleNames.includes("block_lag_high"));
  assert.ok(ruleNames.includes("writeback_failures"));
  assert.ok(ruleNames.includes("disk_space_low"));
});
