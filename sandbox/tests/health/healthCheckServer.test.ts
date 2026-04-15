import assert from "node:assert/strict";
import test from "node:test";

import {
  handleHealthCheckRequest
} from "../../src/health/healthCheckServer";
import type { HealthCheckConfig, ReadinessCheck } from "../../src/health/healthCheckTypes";

function createBaseConfig(overrides: Partial<HealthCheckConfig> = {}): HealthCheckConfig {
  return {
    service: "test-service",
    version: "0.1.0",
    port: 9090,
    host: "127.0.0.1",
    readinessChecks: [],
    startedAt: 1000,
    now: () => 6000,
    ...overrides
  };
}

function createRequestDouble(method: string, url: string): { method: string; url: string } {
  return { method, url };
}

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

test("GET /health returns service health status with uptime", async () => {
  const config = createBaseConfig();
  const response = createResponseDouble();

  await handleHealthCheckRequest(
    createRequestDouble("GET", "/health"),
    response,
    config
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody, {
    status: "ok",
    service: "test-service",
    uptime: 5000,
    version: "0.1.0"
  });
  assert.equal(response.headers["content-type"], "application/json");
});

test("GET /health/live returns 200 with status ok", async () => {
  const config = createBaseConfig();
  const response = createResponseDouble();

  await handleHealthCheckRequest(
    createRequestDouble("GET", "/health/live"),
    response,
    config
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody, { status: "ok" });
});

test("GET /health/ready returns 200 when all checks pass", async () => {
  const checks: ReadinessCheck[] = [
    {
      name: "rpc",
      check: async () => ({
        name: "rpc",
        ok: true,
        message: "reachable",
        durationMs: 10
      })
    },
    {
      name: "disk",
      check: async () => ({
        name: "disk",
        ok: true,
        message: "writable",
        durationMs: 2
      })
    }
  ];

  const config = createBaseConfig({ readinessChecks: checks });
  const response = createResponseDouble();

  await handleHealthCheckRequest(
    createRequestDouble("GET", "/health/ready"),
    response,
    config
  );

  assert.equal(response.statusCode, 200);
  const body = response.jsonBody as { ready: boolean; checks: unknown[] };
  assert.equal(body.ready, true);
  assert.equal(body.checks.length, 2);
});

test("GET /health/ready returns 503 when any check fails", async () => {
  const checks: ReadinessCheck[] = [
    {
      name: "rpc",
      check: async () => ({
        name: "rpc",
        ok: false,
        message: "connection refused",
        durationMs: 500
      })
    },
    {
      name: "disk",
      check: async () => ({
        name: "disk",
        ok: true,
        message: "writable",
        durationMs: 2
      })
    }
  ];

  const config = createBaseConfig({ readinessChecks: checks });
  const response = createResponseDouble();

  await handleHealthCheckRequest(
    createRequestDouble("GET", "/health/ready"),
    response,
    config
  );

  assert.equal(response.statusCode, 503);
  const body = response.jsonBody as { ready: boolean; checks: unknown[] };
  assert.equal(body.ready, false);
  assert.equal(body.checks.length, 2);
});

test("GET /health/ready catches check exceptions and reports as failed", async () => {
  const checks: ReadinessCheck[] = [
    {
      name: "broken",
      check: async () => {
        throw new Error("unexpected error");
      }
    }
  ];

  const config = createBaseConfig({ readinessChecks: checks });
  const response = createResponseDouble();

  await handleHealthCheckRequest(
    createRequestDouble("GET", "/health/ready"),
    response,
    config
  );

  assert.equal(response.statusCode, 503);
  const body = response.jsonBody as {
    ready: boolean;
    checks: Array<{ name: string; ok: boolean; message: string }>;
  };
  assert.equal(body.ready, false);
  assert.equal(body.checks[0].name, "broken");
  assert.equal(body.checks[0].ok, false);
  assert.match(body.checks[0].message, /unexpected error/);
});

test("unknown route returns 404", async () => {
  const config = createBaseConfig();
  const response = createResponseDouble();

  await handleHealthCheckRequest(
    createRequestDouble("GET", "/unknown"),
    response,
    config
  );

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.jsonBody, { error: "not found" });
});

test("POST request to /health returns 404", async () => {
  const config = createBaseConfig();
  const response = createResponseDouble();

  await handleHealthCheckRequest(
    createRequestDouble("POST", "/health"),
    response,
    config
  );

  assert.equal(response.statusCode, 404);
});
