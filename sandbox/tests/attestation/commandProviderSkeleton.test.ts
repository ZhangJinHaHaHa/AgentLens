import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";

test("command provider skeleton reads one request from stdin and emits canonical top-level fields", async () => {
  const scriptPath = path.resolve(
    process.cwd(),
    "examples",
    "tee-command-provider",
    "attest.mjs"
  );
  const input = JSON.stringify({
    schemaVersion: "audit-attestation-request.v1",
    eventKey: "0xabc:0",
    tokenId: "1",
    manifestHash: "a".repeat(64),
    evidenceRoot: "b".repeat(64),
    manifestUrl: "https://example.com/manifest.json"
  });

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn("node", [scriptPath], {
      env: {
        ...process.env,
        TEE_COMMAND_PROVIDER_MODE: "demo"
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    let output = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `child exited with code ${code}`));
        return;
      }
      resolve(output);
    });

    child.stdin.write(input);
    child.stdin.end();
  });

  const parsed = JSON.parse(stdout) as Record<string, string>;

  assert.equal(typeof parsed.measurement, "string");
  assert.equal(typeof parsed.quoteFormat, "string");
  assert.equal(typeof parsed.sessionPublicKey, "string");
  assert.equal(typeof parsed.quote, "string");
  assert.equal(Object.keys(parsed).sort().join(","), "measurement,quote,quoteFormat,sessionPublicKey");
});
