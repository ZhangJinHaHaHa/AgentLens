import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadCdkConfig } from "../../src/cdk/cdkConfig";

test("loadCdkConfig returns production defaults when no config file and no env vars", () => {
  const config = loadCdkConfig({ cwd: os.tmpdir(), env: {} });
  assert.equal(config.rpcUrl, "http://203.91.76.159:18545");
  assert.equal(config.chainId, 302612);
  assert.equal(config.registryAddress, "0x4A679253410272dd5232B3Ff7cF5dbB88f295319");
  assert.equal(config.privateKey, undefined);
});

test("loadCdkConfig reads values from config file", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdk-config-"));
  fs.writeFileSync(
    path.join(tmpDir, "shenji-cdk.config.json"),
    JSON.stringify({
      rpcUrl: "http://localhost:8545",
      chainId: 31337,
      registryAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12"
    })
  );

  const config = loadCdkConfig({ cwd: tmpDir, env: {} });
  assert.equal(config.rpcUrl, "http://localhost:8545");
  assert.equal(config.chainId, 31337);
  assert.equal(config.registryAddress, "0xABCDEF1234567890ABCDEF1234567890ABCDEF12");

  fs.rmSync(tmpDir, { recursive: true });
});

test("loadCdkConfig env vars override config file", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdk-config-"));
  fs.writeFileSync(
    path.join(tmpDir, "shenji-cdk.config.json"),
    JSON.stringify({ rpcUrl: "http://file.local", chainId: 100 })
  );

  const config = loadCdkConfig({
    cwd: tmpDir,
    env: {
      SHENJI_CDK_RPC_URL: "http://env.local",
      SHENJI_CDK_CHAIN_ID: "200",
      SHENJI_CDK_PRIVATE_KEY: "0xdeadbeef"
    }
  });

  assert.equal(config.rpcUrl, "http://env.local");
  assert.equal(config.chainId, 200);
  assert.equal(config.privateKey, "0xdeadbeef");

  fs.rmSync(tmpDir, { recursive: true });
});

test("loadCdkConfig throws on invalid chainId", () => {
  assert.throws(
    () => loadCdkConfig({ cwd: os.tmpdir(), env: { SHENJI_CDK_CHAIN_ID: "not-a-number" } }),
    { message: /Invalid chainId/ }
  );
});

test("loadCdkConfig ignores missing config file gracefully", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdk-config-"));
  const config = loadCdkConfig({ cwd: tmpDir, env: {} });
  assert.equal(config.rpcUrl, "http://203.91.76.159:18545");
  fs.rmSync(tmpDir, { recursive: true });
});

test("loadCdkConfig ignores malformed config file", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdk-config-"));
  fs.writeFileSync(path.join(tmpDir, "shenji-cdk.config.json"), "not valid json!!!");
  const config = loadCdkConfig({ cwd: tmpDir, env: {} });
  assert.equal(config.rpcUrl, "http://203.91.76.159:18545");
  fs.rmSync(tmpDir, { recursive: true });
});
