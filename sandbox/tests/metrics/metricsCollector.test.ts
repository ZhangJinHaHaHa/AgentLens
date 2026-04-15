import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetricsCollector,
  handleMetricsRequest
} from "../../src/metrics/metricsCollector";

test("createMetricsCollector returns a collector with zero-valued counters", () => {
  const collector = createMetricsCollector();
  const snapshot = collector.snapshot();

  const auditsTotal = snapshot.counters.find((c) => c.name === "audits_total");
  assert.ok(auditsTotal);
  assert.equal(auditsTotal.value, 0);
});

test("incrementCounter increases counter by 1", () => {
  const collector = createMetricsCollector();
  const updated = collector.incrementCounter("audits_total");
  const snapshot = updated.snapshot();

  const auditsTotal = snapshot.counters.find((c) => c.name === "audits_total");
  assert.ok(auditsTotal);
  assert.equal(auditsTotal.value, 1);
});

test("incrementCounter can be called multiple times", () => {
  const collector = createMetricsCollector();
  const updated = collector
    .incrementCounter("audits_total")
    .incrementCounter("audits_total")
    .incrementCounter("audits_total");
  const snapshot = updated.snapshot();

  const auditsTotal = snapshot.counters.find((c) => c.name === "audits_total");
  assert.ok(auditsTotal);
  assert.equal(auditsTotal.value, 3);
});

test("incrementCounter increments different counters independently", () => {
  const collector = createMetricsCollector();
  const updated = collector
    .incrementCounter("audits_total")
    .incrementCounter("audits_passed")
    .incrementCounter("audits_passed");
  const snapshot = updated.snapshot();

  const auditsTotal = snapshot.counters.find((c) => c.name === "audits_total");
  const auditsPassed = snapshot.counters.find((c) => c.name === "audits_passed");
  assert.ok(auditsTotal);
  assert.ok(auditsPassed);
  assert.equal(auditsTotal.value, 1);
  assert.equal(auditsPassed.value, 2);
});

test("incrementCounterBy increases counter by a custom amount", () => {
  const collector = createMetricsCollector();
  const updated = collector.incrementCounterBy("writebacks_total", 5);
  const snapshot = updated.snapshot();

  const writebacksTotal = snapshot.counters.find((c) => c.name === "writebacks_total");
  assert.ok(writebacksTotal);
  assert.equal(writebacksTotal.value, 5);
});

test("setGauge sets a gauge value", () => {
  const collector = createMetricsCollector();
  const updated = collector.setGauge("current_block_lag", 42);
  const snapshot = updated.snapshot();

  const lag = snapshot.gauges.find((g) => g.name === "current_block_lag");
  assert.ok(lag);
  assert.equal(lag.value, 42);
});

test("setGauge overwrites previous gauge value", () => {
  const collector = createMetricsCollector();
  const updated = collector
    .setGauge("current_block_lag", 42)
    .setGauge("current_block_lag", 10);
  const snapshot = updated.snapshot();

  const lag = snapshot.gauges.find((g) => g.name === "current_block_lag");
  assert.ok(lag);
  assert.equal(lag.value, 10);
});

test("recordDuration sets duration gauge", () => {
  const collector = createMetricsCollector();
  const updated = collector.recordDuration("audit_duration_ms", 1500);
  const snapshot = updated.snapshot();

  const duration = snapshot.gauges.find((g) => g.name === "audit_duration_ms");
  assert.ok(duration);
  assert.equal(duration.value, 1500);
});

test("snapshot includes all known counters even if not incremented", () => {
  const collector = createMetricsCollector();
  const snapshot = collector.snapshot();

  const counterNames = snapshot.counters.map((c) => c.name);
  assert.ok(counterNames.includes("audits_total"));
  assert.ok(counterNames.includes("audits_passed"));
  assert.ok(counterNames.includes("audits_failed"));
  assert.ok(counterNames.includes("slashes_total"));
  assert.ok(counterNames.includes("writebacks_total"));
  assert.ok(counterNames.includes("writebacks_failed"));
});

test("snapshot includes all known gauges even if not set", () => {
  const collector = createMetricsCollector();
  const snapshot = collector.snapshot();

  const gaugeNames = snapshot.gauges.map((g) => g.name);
  assert.ok(gaugeNames.includes("audit_duration_ms"));
  assert.ok(gaugeNames.includes("current_block_lag"));
});

test("snapshot includes collectedAt timestamp", () => {
  const collector = createMetricsCollector({
    now: () => new Date("2026-04-11T00:00:00Z")
  });
  const snapshot = collector.snapshot();

  assert.equal(snapshot.collectedAt, "2026-04-11T00:00:00.000Z");
});

test("original collector is not mutated by incrementCounter", () => {
  const collector = createMetricsCollector();
  const updated = collector.incrementCounter("audits_total");

  const originalSnapshot = collector.snapshot();
  const updatedSnapshot = updated.snapshot();

  const originalValue = originalSnapshot.counters.find((c) => c.name === "audits_total")?.value;
  const updatedValue = updatedSnapshot.counters.find((c) => c.name === "audits_total")?.value;

  assert.equal(originalValue, 0);
  assert.equal(updatedValue, 1);
});

test("original collector is not mutated by setGauge", () => {
  const collector = createMetricsCollector();
  const updated = collector.setGauge("current_block_lag", 99);

  const originalSnapshot = collector.snapshot();
  const updatedSnapshot = updated.snapshot();

  const originalValue = originalSnapshot.gauges.find((g) => g.name === "current_block_lag")?.value;
  const updatedValue = updatedSnapshot.gauges.find((g) => g.name === "current_block_lag")?.value;

  assert.equal(originalValue, 0);
  assert.equal(updatedValue, 99);
});

// ---------- handleMetricsRequest ----------

function createResponseDouble(): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  jsonBody: unknown;
  setHeader(name: string, value: string): void;
  end(body: string): void;
} {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    jsonBody: undefined,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body: string) {
      this.body = body;
      try {
        this.jsonBody = JSON.parse(body);
      } catch {
        this.jsonBody = undefined;
      }
    }
  };
}

test("handleMetricsRequest returns JSON snapshot on GET /metrics", () => {
  const collector = createMetricsCollector()
    .incrementCounter("audits_total")
    .setGauge("current_block_lag", 5);

  const response = createResponseDouble();
  handleMetricsRequest(
    { method: "GET", url: "/metrics" },
    response,
    collector
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/json");
  const body = response.jsonBody as { counters: Array<{ name: string; value: number }> };
  const auditsTotal = body.counters.find((c) => c.name === "audits_total");
  assert.ok(auditsTotal);
  assert.equal(auditsTotal.value, 1);
});

test("handleMetricsRequest returns 404 for unknown paths", () => {
  const collector = createMetricsCollector();
  const response = createResponseDouble();

  handleMetricsRequest(
    { method: "GET", url: "/unknown" },
    response,
    collector
  );

  assert.equal(response.statusCode, 404);
});
