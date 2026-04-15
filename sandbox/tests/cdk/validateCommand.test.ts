import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runValidateCommand } from "../../src/cdk/commands/validateCommand";

function writeManifest(dir: string, data: object): string {
  const filePath = path.join(dir, "manifest.json");
  fs.writeFileSync(filePath, JSON.stringify(data), "utf8");
  return filePath;
}

test("validateCommand passes for valid manifest", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdk-validate-"));
  const manifestPath = writeManifest(tmpDir, {
    agent_name: "valid-agent",
    image: "docker.io/test:latest",
    allowed_hosts: ["api.example.com"],
    allowed_rpc_endpoints: ["https://rpc.example.com"]
  });

  const originalExitCode = process.exitCode;
  await runValidateCommand({ manifest: manifestPath, docker: false });
  assert.notEqual(process.exitCode, 1);
  process.exitCode = originalExitCode;

  fs.rmSync(tmpDir, { recursive: true });
});

test("validateCommand fails for missing file", async () => {
  const originalExitCode = process.exitCode;
  await runValidateCommand({ manifest: "/nonexistent/manifest.json", docker: false });
  assert.equal(process.exitCode, 1);
  process.exitCode = originalExitCode;
});

test("validateCommand fails for invalid JSON", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdk-validate-"));
  const filePath = path.join(tmpDir, "manifest.json");
  fs.writeFileSync(filePath, "not json!!!", "utf8");

  const originalExitCode = process.exitCode;
  await runValidateCommand({ manifest: filePath, docker: false });
  assert.equal(process.exitCode, 1);
  process.exitCode = originalExitCode;

  fs.rmSync(tmpDir, { recursive: true });
});

test("validateCommand fails for invalid manifest schema", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdk-validate-"));
  const manifestPath = writeManifest(tmpDir, {
    agent_name: "!!!invalid",
    image: "",
    allowed_hosts: [],
    allowed_rpc_endpoints: []
  });

  const originalExitCode = process.exitCode;
  await runValidateCommand({ manifest: manifestPath, docker: false });
  assert.equal(process.exitCode, 1);
  process.exitCode = originalExitCode;

  fs.rmSync(tmpDir, { recursive: true });
});
