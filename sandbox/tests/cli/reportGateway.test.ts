import assert from "node:assert/strict";
import test from "node:test";

import { runReportGatewayCli } from "../../src/cli/reportGateway";
import type { ReportGatewayConfig } from "../../src/report/readReportGatewayConfig";

test("runReportGatewayCli starts the report gateway server and logs the listening config", async () => {
  const listenCalls: Array<{ host: string; port: number }> = [];
  const stdout: string[] = [];

  await runReportGatewayCli(
    {
      AUDIT_REPORT_GATEWAY_HOST: "127.0.0.1",
      AUDIT_REPORT_GATEWAY_PORT: "3999",
      AUDIT_REPORT_GATEWAY_UPSTREAM_BASE_URL: "https://gateway.example/ipfs/"
    },
    {
      createServer(config: ReportGatewayConfig) {
        return {
          once(_event: string, _handler: (...args: unknown[]) => void) {
            return this;
          },
          listen(port: number, host: string, callback: () => void) {
            listenCalls.push({ host, port });
            callback();
            return this;
          }
        };
      },
      writeStdout(line: string) {
        stdout.push(line);
      }
    }
  );

  assert.deepEqual(listenCalls, [{ host: "127.0.0.1", port: 3999 }]);
  assert.deepEqual(stdout, [
    `${JSON.stringify({
      type: "report-gateway-listening",
      host: "127.0.0.1",
      port: 3999,
      upstreamBaseUrl: "https://gateway.example/ipfs/"
    })}\n`
  ]);
});
