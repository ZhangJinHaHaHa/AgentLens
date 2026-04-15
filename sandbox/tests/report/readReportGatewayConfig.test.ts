import assert from "node:assert/strict";
import test from "node:test";

import { readReportGatewayConfig } from "../../src/report/readReportGatewayConfig";

test("readReportGatewayConfig returns canonical defaults", () => {
  assert.deepEqual(
    readReportGatewayConfig({
      AUDIT_REPORT_GATEWAY_UPSTREAM_BASE_URL: "https://gateway.example/ipfs"
    }),
    {
      host: "0.0.0.0",
      port: 3101,
      upstreamBaseUrl: "https://gateway.example/ipfs/",
      authToken: undefined,
      fetchTimeoutMs: 15000
    }
  );
});

test("readReportGatewayConfig accepts explicit overrides", () => {
  assert.deepEqual(
    readReportGatewayConfig({
      AUDIT_REPORT_GATEWAY_HOST: "127.0.0.1",
      AUDIT_REPORT_GATEWAY_PORT: "3999",
      AUDIT_REPORT_GATEWAY_UPSTREAM_BASE_URL: "https://gateway.example/custom/",
      AUDIT_REPORT_GATEWAY_AUTH_TOKEN: "token-123",
      AUDIT_REPORT_GATEWAY_FETCH_TIMEOUT_MS: "2500"
    }),
    {
      host: "127.0.0.1",
      port: 3999,
      upstreamBaseUrl: "https://gateway.example/custom/",
      authToken: "token-123",
      fetchTimeoutMs: 2500
    }
  );
});

test("readReportGatewayConfig rejects missing or invalid values", () => {
  assert.throws(() => readReportGatewayConfig({}), /AUDIT_REPORT_GATEWAY_UPSTREAM_BASE_URL is required/);
  assert.throws(
    () =>
      readReportGatewayConfig({
        AUDIT_REPORT_GATEWAY_UPSTREAM_BASE_URL: "https://gateway.example/ipfs/",
        AUDIT_REPORT_GATEWAY_PORT: "-1"
      }),
    /AUDIT_REPORT_GATEWAY_PORT must be a non-negative integer/
  );
  assert.throws(
    () =>
      readReportGatewayConfig({
        AUDIT_REPORT_GATEWAY_UPSTREAM_BASE_URL: "https://gateway.example/ipfs/",
        AUDIT_REPORT_GATEWAY_PORT: "70000"
      }),
    /AUDIT_REPORT_GATEWAY_PORT must be between 0 and 65535/
  );
  assert.throws(
    () =>
      readReportGatewayConfig({
        AUDIT_REPORT_GATEWAY_UPSTREAM_BASE_URL: "https://gateway.example/ipfs/",
        AUDIT_REPORT_GATEWAY_FETCH_TIMEOUT_MS: "0"
      }),
    /AUDIT_REPORT_GATEWAY_FETCH_TIMEOUT_MS must be a positive integer/
  );
});
