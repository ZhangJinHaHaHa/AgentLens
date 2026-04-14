import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runInitCommand } from "../../src/cdk/commands/initCommand";

function makeSequentialAsker(answers: string[]): (question: string) => Promise<string> {
  let index = 0;
  return async () => {
    const answer = answers[index] ?? "";
    index++;
    return answer;
  };
}

test("initCommand creates manifest.json with valid inputs", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdk-init-"));
  const outputPath = path.join(tmpDir, "manifest.json");

  await runInitCommand({
    output: outputPath,
    deps: {
      askUser: makeSequentialAsker([
        "my-test-agent",
        "docker.io/my-agent:latest",
        "api.example.com",
        "https://rpc.example.com"
      ])
    }
  });

  const manifest = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(manifest.agent_name, "my-test-agent");
  assert.equal(manifest.image, "docker.io/my-agent:latest");
  assert.deepEqual(manifest.allowed_hosts, ["api.example.com"]);
  assert.deepEqual(manifest.allowed_rpc_endpoints, ["https://rpc.example.com"]);

  fs.rmSync(tmpDir, { recursive: true });
});

test("initCommand rejects invalid agent name", async () => {
  const originalExitCode = process.exitCode;

  await runInitCommand({
    output: "/dev/null",
    deps: { askUser: makeSequentialAsker(["invalid name!!!"]) }
  });

  assert.equal(process.exitCode, 1);
  process.exitCode = originalExitCode;
});

test("initCommand rejects empty image", async () => {
  const originalExitCode = process.exitCode;

  await runInitCommand({
    output: "/dev/null",
    deps: { askUser: makeSequentialAsker(["valid-name", ""]) }
  });

  assert.equal(process.exitCode, 1);
  process.exitCode = originalExitCode;
});

test("initCommand handles multiple comma-separated hosts", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdk-init-"));
  const outputPath = path.join(tmpDir, "manifest.json");

  await runInitCommand({
    output: outputPath,
    deps: {
      askUser: makeSequentialAsker([
        "multi-host-agent",
        "docker.io/multi:v1",
        "api.example.com, cdn.example.com",
        "https://rpc1.example.com, https://rpc2.example.com"
      ])
    }
  });

  const manifest = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.deepEqual(manifest.allowed_hosts, ["api.example.com", "cdn.example.com"]);
  assert.deepEqual(manifest.allowed_rpc_endpoints, [
    "https://rpc1.example.com",
    "https://rpc2.example.com"
  ]);

  fs.rmSync(tmpDir, { recursive: true });
});
