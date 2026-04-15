import test from "node:test";
import assert from "node:assert/strict";

import { buildAuditReport, computeAuditReportHash } from "../../src/report/buildAuditReport";
import type { LocalAuditResult } from "../../src/types/manifest";

test("buildAuditReport maps a local audit result into the detailed report shape", () => {
  const result = buildAuditReport({
    agentName: "risk-agent",
    manifestHash: "manifest-hash-123",
    healthcheckPassed: true,
    answer: "safe result",
    actions: [{ type: "web_request", url: "https://api.risk.com/v1/alert" }],
    decisionType: "undetermined",
    actionReconciliation: {
      declaredHosts: ["api.risk.com"],
      observedHosts: ["api.risk.com"],
      undeclaredObservedHosts: [],
      declaredUnobservedHosts: []
    },
    cpuAvgMilli: 123,
    memoryPeakMb: 256,
    requestedIps: ["203.0.113.10"],
    requestedHosts: ["api.risk.com"],
    requestCount: 1,
    networkEvidence: {
      source: "procfs",
      observedAt: "2026-03-28T10:00:06.000Z",
      connections: [
        {
          protocol: "tcp4",
          remoteIp: "203.0.113.10",
          remotePort: 443,
          state: "ESTABLISHED"
        }
      ]
    },
    status: "completed",
    startedAt: "2026-03-23T10:00:00.000Z",
    finishedAt: "2026-03-23T10:00:05.000Z"
  });

  assert.deepEqual(result.report, {
    schemaVersion: "audit-report.v1",
    agentName: "risk-agent",
    manifestHash: "manifest-hash-123",
    status: "completed",
    decisionType: "undetermined",
    healthcheckPassed: true,
    resourceMetrics: {
      cpuAvgMilli: 123,
      memoryPeakMb: 256
    },
    networkActivity: {
      requestedIps: ["203.0.113.10"],
      requestedHosts: ["api.risk.com"],
      requestCount: 1
    },
    networkEvidence: {
      source: "procfs",
      observedAt: "2026-03-28T10:00:06.000Z",
      connections: [
        {
          protocol: "tcp4",
          remoteIp: "203.0.113.10",
          remotePort: 443,
          state: "ESTABLISHED"
        }
      ]
    },
    responseTrace: {
      answer: "safe result",
      actions: [{ type: "web_request", url: "https://api.risk.com/v1/alert" }],
      reconciliation: {
        declaredHosts: ["api.risk.com"],
        observedHosts: ["api.risk.com"],
        undeclaredObservedHosts: [],
        declaredUnobservedHosts: []
      }
    },
    timestamps: {
      startedAt: "2026-03-23T10:00:00.000Z",
      finishedAt: "2026-03-23T10:00:05.000Z"
    }
  });
  assert.equal(typeof result.reportJson, "string");
  assert.equal(result.reportHash.length, 64);
});

test("buildAuditReport omits reconciliation when action reconciliation data is missing", () => {
  const result = buildAuditReport({
    agentName: "risk-agent",
    manifestHash: "manifest-hash-123",
    healthcheckPassed: true,
    answer: "safe result",
    actions: [{ type: "web_request", url: "https://api.risk.com/v1/alert" }],
    decisionType: "undetermined",
    cpuAvgMilli: 123,
    memoryPeakMb: 256,
    requestedIps: ["203.0.113.10"],
    requestedHosts: ["api.risk.com"],
    requestCount: 1,
    status: "completed",
    startedAt: "2026-03-23T10:00:00.000Z",
    finishedAt: "2026-03-23T10:00:05.000Z"
  });

  assert.equal(result.report.decisionType, "undetermined");
  assert.deepEqual(result.report.responseTrace, {
    answer: "safe result",
    actions: [{ type: "web_request", url: "https://api.risk.com/v1/alert" }]
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(result.report.responseTrace, "reconciliation"),
    false
  );
});

test("buildAuditReport returns a stable hash for the same input and a different hash when content changes", () => {
  const baseInput: LocalAuditResult = {
    agentName: "risk-agent",
    manifestHash: "manifest-hash-123",
    healthcheckPassed: true,
    answer: "safe result",
    actions: [{ type: "web_request", url: "https://api.risk.com/v1/alert" }],
    decisionType: "undetermined",
    actionReconciliation: {
      declaredHosts: ["api.risk.com"],
      observedHosts: ["api.risk.com"],
      undeclaredObservedHosts: [],
      declaredUnobservedHosts: []
    },
    cpuAvgMilli: 123,
    memoryPeakMb: 256,
    requestedIps: ["203.0.113.10"],
    requestedHosts: ["api.risk.com"],
    requestCount: 1,
    networkEvidence: {
      source: "procfs",
      observedAt: "2026-03-28T10:00:06.000Z",
      connections: [
        {
          protocol: "tcp4",
          remoteIp: "203.0.113.10",
          remotePort: 443,
          state: "ESTABLISHED"
        }
      ]
    },
    status: "completed",
    startedAt: "2026-03-23T10:00:00.000Z",
    finishedAt: "2026-03-23T10:00:05.000Z"
  };

  const first = buildAuditReport(baseInput);
  const second = buildAuditReport(baseInput);
  const changed = buildAuditReport({
    ...baseInput,
    decisionType: "redline_violation"
  });

  assert.equal(first.reportJson, second.reportJson);
  assert.equal(first.reportHash, second.reportHash);
  assert.notEqual(first.reportHash, changed.reportHash);
  assert.equal(changed.report.decisionType, "redline_violation");
});

test("computeAuditReportHash stays stable and matches buildAuditReport hashing", () => {
  const stableJson = '{"a":1,"b":"two"}';
  const changedJson = '{"a":2,"b":"two"}';

  const first = computeAuditReportHash(stableJson);
  const second = computeAuditReportHash(stableJson);
  const changed = computeAuditReportHash(changedJson);

  assert.equal(first, second);
  assert.notEqual(first, changed);

  const built = buildAuditReport({
    agentName: "risk-agent",
    manifestHash: "manifest-hash-123",
    healthcheckPassed: true,
    answer: "safe result",
    actions: [{ type: "web_request", url: "https://api.risk.com/v1/alert" }],
    decisionType: "undetermined",
    cpuAvgMilli: 123,
    memoryPeakMb: 256,
    requestedIps: ["203.0.113.10"],
    requestedHosts: ["api.risk.com"],
    requestCount: 1,
    status: "completed",
    startedAt: "2026-03-23T10:00:00.000Z",
    finishedAt: "2026-03-23T10:00:05.000Z"
  });
  assert.equal(built.reportHash, computeAuditReportHash(built.reportJson));
});

test("buildAuditReport includes evidence metadata when provided", () => {
  const result = buildAuditReport(
    {
      agentName: "risk-agent",
      manifestHash: "manifest-hash-123",
      healthcheckPassed: true,
      answer: "safe result",
      actions: [],
      decisionType: "undetermined",
      cpuAvgMilli: 123,
      memoryPeakMb: 256,
      requestedIps: [],
      requestedHosts: [],
      requestCount: 0,
      status: "completed",
      startedAt: "2026-03-23T10:00:00.000Z",
      finishedAt: "2026-03-23T10:00:05.000Z"
    },
    {
      evidence: {
        eventCount: 4,
        evidenceRoot: "e".repeat(64),
        attestationHash: "0".repeat(64),
        evidenceCid: ""
      }
    }
  );

  assert.deepEqual(result.report.evidence, {
    eventCount: 4,
    evidenceRoot: "e".repeat(64),
    attestationHash: "0".repeat(64),
    evidenceCid: ""
  });
});
