import test from "node:test";
import assert from "node:assert/strict";

import { reconcileAuditResponse } from "../../src/audit/reconcileAuditResponse";
import type { AuditAction } from "../../src/types/manifest";

function buildAction(overrides: Partial<AuditAction> = {}): AuditAction {
  return {
    type: "web_request",
    url: "https://api.risk.com/v1/alert",
    ...overrides
  };
}

function buildActivity(requestedHosts: string[]): { requestedHosts: string[] } {
  return { requestedHosts };
}

test("reconcileAuditResponse returns no reason when declared hosts match observed hosts", () => {
  const reconciliation = reconcileAuditResponse(
    [
      buildAction(),
      buildAction({ url: "https://other.risk.com/data" })
    ],
    buildActivity(["other.risk.com", "api.risk.com", "other.risk.com"])
  );

  assert.deepEqual(reconciliation, {
    declaredHosts: ["api.risk.com", "other.risk.com"],
    observedHosts: ["api.risk.com", "other.risk.com"],
    undeclaredObservedHosts: [],
    declaredUnobservedHosts: []
  });
});

test("reconcileAuditResponse reports ACTION_MISMATCH for observed-only hosts", () => {
  const reconciliation = reconcileAuditResponse([], buildActivity(["api.risk.com"]));

  assert.deepEqual(reconciliation, {
    declaredHosts: [],
    observedHosts: ["api.risk.com"],
    undeclaredObservedHosts: ["api.risk.com"],
    declaredUnobservedHosts: [],
    reasonCode: "ACTION_MISMATCH"
  });
});

test("reconcileAuditResponse returns ACTION_MISMATCH when a declared host is never observed", () => {
  const reconciliation = reconcileAuditResponse(
    [buildAction()],
    buildActivity([])
  );

  assert.deepEqual(reconciliation, {
    declaredHosts: ["api.risk.com"],
    observedHosts: [],
    undeclaredObservedHosts: [],
    declaredUnobservedHosts: ["api.risk.com"],
    reasonCode: "ACTION_MISMATCH"
  });
});

test("reconcileAuditResponse ignores non-network actions", () => {
  const reconciliation = reconcileAuditResponse(
    [
      {
        type: "compute",
        payload: { task: "noop" }
      }
    ],
    buildActivity([])
  );

  assert.deepEqual(reconciliation, {
    declaredHosts: [],
    observedHosts: [],
    undeclaredObservedHosts: [],
    declaredUnobservedHosts: []
  });
});

test("reconcileAuditResponse ignores invalid URLs", () => {
  const reconciliation = reconcileAuditResponse(
    [
      buildAction({ url: "bootstrap" }),
      buildAction({ url: "https://api.risk.com/v1/alert" })
    ],
    buildActivity([])
  );

  assert.deepEqual(reconciliation, {
    declaredHosts: ["api.risk.com"],
    observedHosts: [],
    undeclaredObservedHosts: [],
    declaredUnobservedHosts: ["api.risk.com"],
    reasonCode: "ACTION_MISMATCH"
  });
});

test("reconcileAuditResponse lowercases and deduplicates observed hosts", () => {
  const reconciliation = reconcileAuditResponse(
    [buildAction()],
    buildActivity(["API.Risk.Com", " api.risk.com ", "API.Risk.Com"])
  );

  assert.deepEqual(reconciliation, {
    declaredHosts: ["api.risk.com"],
    observedHosts: ["api.risk.com"],
    undeclaredObservedHosts: [],
    declaredUnobservedHosts: []
  });
});
