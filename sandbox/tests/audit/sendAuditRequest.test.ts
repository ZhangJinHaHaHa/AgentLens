import test from "node:test";
import assert from "node:assert/strict";

import {
  sendAuditRequest,
  ProtocolViolationError,
  type FetchLike
} from "../../src/audit/sendAuditRequest";

test("sendAuditRequest posts to /audit/solve and returns answer/actions", async () => {
  const requests: Array<{ url: string; method?: string; body?: string }> = [];
  const fetchImpl: FetchLike = async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method,
      body: String(init?.body ?? "")
    });

    return new Response(
      JSON.stringify({
        answer: "safe result",
        actions: [{ type: "web_request", url: "https://api.risk.com/v1/alert" }]
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" }
      }
    );
  };

  const response = await sendAuditRequest({
    host: "127.0.0.1",
    port: 18080,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    timeoutMs: 500,
    fetchImpl
  });

  assert.equal(response.answer, "safe result");
  assert.deepEqual(response.actions, [{ type: "web_request", url: "https://api.risk.com/v1/alert" }]);
  assert.deepEqual(requests, [
    {
      url: "http://127.0.0.1:18080/audit/solve",
      method: "POST",
      body: JSON.stringify({
        task_id: "task-123",
        question: "question",
        context: { history: [] },
        constraints: { response_format: "json" }
      })
    }
  ]);
});

test("sendAuditRequest throws PROTOCOL_VIOLATION when response is missing actions", async () => {
  const fetchImpl: FetchLike = async () =>
    new Response(JSON.stringify({ answer: "safe result" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });

  await assert.rejects(
    () =>
      sendAuditRequest({
        host: "127.0.0.1",
        port: 18080,
        request: {
          task_id: "task-123",
          question: "question",
          context: { history: [] },
          constraints: { response_format: "json" }
        },
        timeoutMs: 500,
        fetchImpl
      }),
    (error: unknown) =>
      error instanceof ProtocolViolationError && error.reasonCode === "PROTOCOL_VIOLATION"
  );
});
