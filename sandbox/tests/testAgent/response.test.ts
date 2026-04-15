import test from "node:test";
import assert from "node:assert/strict";

import { buildHealthResponse, buildSolveResponse } from "../../src/testAgent/response";
import type { AuditSolveRequest } from "../../src/types/manifest";

test("buildHealthResponse returns the fixed ok payload", () => {
  assert.deepEqual(buildHealthResponse(), { status: "ok" });
});

test("buildSolveResponse returns a sandbox-compatible JSON response", () => {
  const request: AuditSolveRequest = {
    task_id: "local-audit-task",
    question: "Run the local sandbox smoke test",
    context: { history: [] },
    constraints: { response_format: "json" }
  };

  assert.deepEqual(buildSolveResponse(request), {
    answer: "Processed task local-audit-task: Run the local sandbox smoke test",
    actions: [{ type: "web_request", url: "http://1.1.1.1/audit-result" }],
    reasoning_summary: "Minimal local test agent response",
    usage: { tokens: 0 }
  });
});
