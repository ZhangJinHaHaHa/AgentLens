import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  getAcceptanceExitCode,
  parseAcceptanceCliArgs,
  writeAcceptanceReport
} from "../../src/cli/acceptanceCommand";

test("parseAcceptanceCliArgs returns required acceptance arguments and optional output path", () => {
  const args = parseAcceptanceCliArgs([
    "node",
    "acceptance.js",
    "--manifest",
    "./fixtures/manifest.valid.json",
    "--allowed-egress-target",
    "https://api.risk.com",
    "--blocked-egress-target",
    "https://malicious.example",
    "--output",
    "./reports/acceptance.json"
  ]);

  assert.deepEqual(args, {
    manifestPath: "./fixtures/manifest.valid.json",
    allowedEgressTargetUrl: "https://api.risk.com",
    blockedEgressTargetUrl: "https://malicious.example",
    outputPath: "./reports/acceptance.json"
  });
});

test("getAcceptanceExitCode returns 0 only when acceptance succeeded", () => {
  assert.equal(
    getAcceptanceExitCode({
      manifestValid: true,
      dockerAvailable: true,
      accepted: true
    }),
    0
  );

  assert.equal(
    getAcceptanceExitCode({
      manifestValid: true,
      dockerAvailable: false,
      accepted: false,
      reasonCode: "DOCKER_UNAVAILABLE"
    }),
    1
  );
});

test("writeAcceptanceReport writes the JSON report to the requested file", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "sandbox-acceptance-report-"));
  const reportPath = path.join(dir, "acceptance.json");

  await writeAcceptanceReport(reportPath, {
    manifestValid: true,
    dockerAvailable: true,
    accepted: false,
    reasonCode: "UNDECLARED_EGRESS"
  });

  const written = await readFile(reportPath, "utf8");

  assert.deepEqual(JSON.parse(written), {
    manifestValid: true,
    dockerAvailable: true,
    accepted: false,
    reasonCode: "UNDECLARED_EGRESS"
  });
});
