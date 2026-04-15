import test from "node:test";
import assert from "node:assert/strict";

import { waitForHealth, AgentUnavailableError, type FetchLike } from "../../src/docker/healthcheck";

test("waitForHealth succeeds when /audit/health returns {status: ok}", async () => {
  const requests: string[] = [];
  const fetchImpl: FetchLike = async (input) => {
    requests.push(String(input));

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  await waitForHealth({
    host: "127.0.0.1",
    port: 18080,
    maxAttempts: 1,
    retryDelayMs: 10,
    fetchImpl
  });

  assert.deepEqual(requests, ["http://127.0.0.1:18080/audit/health"]);
});

test("waitForHealth throws AGENT_UNAVAILABLE after exhausting retries", async () => {
  let calls = 0;
  const fetchImpl: FetchLike = async () => {
    calls += 1;
    return new Response(JSON.stringify({ status: "down" }), {
      status: 503,
      headers: { "content-type": "application/json" }
    });
  };

  await assert.rejects(
    () =>
      waitForHealth({
        host: "127.0.0.1",
        port: 18080,
        maxAttempts: 2,
        retryDelayMs: 10,
        fetchImpl
      }),
    (error: unknown) =>
      error instanceof AgentUnavailableError && error.reasonCode === "AGENT_UNAVAILABLE"
  );

  assert.equal(calls, 2);
});
