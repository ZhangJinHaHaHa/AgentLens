import assert from "node:assert/strict";
import test from "node:test";

import {
  createRpcCheck,
  createAttestationApiCheck,
  createDiskWritableCheck
} from "../../src/health/dependencyChecker";

// ---------- RPC Check ----------

test("createRpcCheck returns ok when eth_blockNumber succeeds", async () => {
  const fetchImpl = async (): Promise<Response> => {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1a2b3c" }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  const check = createRpcCheck("http://localhost:8545", fetchImpl as typeof fetch);
  const result = await check.check();

  assert.equal(result.name, "rpc");
  assert.equal(result.ok, true);
  assert.match(result.message, /block/i);
  assert.ok(result.durationMs >= 0);
});

test("createRpcCheck returns not ok when fetch throws", async () => {
  const fetchImpl = async (): Promise<Response> => {
    throw new Error("connection refused");
  };

  const check = createRpcCheck("http://localhost:8545", fetchImpl as typeof fetch);
  const result = await check.check();

  assert.equal(result.name, "rpc");
  assert.equal(result.ok, false);
  assert.match(result.message, /connection refused/);
});

test("createRpcCheck returns not ok when RPC returns an error response", async () => {
  const fetchImpl = async (): Promise<Response> => {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "Method not found" } }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  const check = createRpcCheck("http://localhost:8545", fetchImpl as typeof fetch);
  const result = await check.check();

  assert.equal(result.name, "rpc");
  assert.equal(result.ok, false);
  assert.match(result.message, /error/i);
});

// ---------- Attestation API Check ----------

test("createAttestationApiCheck returns ok when API responds 200", async () => {
  const fetchImpl = async (): Promise<Response> => {
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  };

  const check = createAttestationApiCheck("http://localhost:3100", fetchImpl as typeof fetch);
  const result = await check.check();

  assert.equal(result.name, "attestation-api");
  assert.equal(result.ok, true);
  assert.ok(result.durationMs >= 0);
});

test("createAttestationApiCheck returns not ok when API is unreachable", async () => {
  const fetchImpl = async (): Promise<Response> => {
    throw new Error("ECONNREFUSED");
  };

  const check = createAttestationApiCheck("http://localhost:3100", fetchImpl as typeof fetch);
  const result = await check.check();

  assert.equal(result.name, "attestation-api");
  assert.equal(result.ok, false);
  assert.match(result.message, /ECONNREFUSED/);
});

test("createAttestationApiCheck returns not ok when API responds with 500", async () => {
  const fetchImpl = async (): Promise<Response> => {
    return new Response("Internal Server Error", { status: 500 });
  };

  const check = createAttestationApiCheck("http://localhost:3100", fetchImpl as typeof fetch);
  const result = await check.check();

  assert.equal(result.name, "attestation-api");
  assert.equal(result.ok, false);
  assert.match(result.message, /500/);
});

// ---------- Disk Writable Check ----------

test("createDiskWritableCheck returns ok when directory is writable", async () => {
  const writeFile = async (): Promise<void> => {};
  const unlink = async (): Promise<void> => {};

  const check = createDiskWritableCheck("/tmp/test-state", { writeFile, unlink });
  const result = await check.check();

  assert.equal(result.name, "disk");
  assert.equal(result.ok, true);
  assert.match(result.message, /writable/i);
  assert.ok(result.durationMs >= 0);
});

test("createDiskWritableCheck returns not ok when directory is not writable", async () => {
  const writeFile = async (): Promise<void> => {
    throw new Error("EACCES: permission denied");
  };
  const unlink = async (): Promise<void> => {};

  const check = createDiskWritableCheck("/tmp/test-state", { writeFile, unlink });
  const result = await check.check();

  assert.equal(result.name, "disk");
  assert.equal(result.ok, false);
  assert.match(result.message, /EACCES/);
});

test("createDiskWritableCheck does not fail when unlink fails after successful write", async () => {
  const writeFile = async (): Promise<void> => {};
  const unlink = async (): Promise<void> => {
    throw new Error("ENOENT");
  };

  const check = createDiskWritableCheck("/tmp/test-state", { writeFile, unlink });
  const result = await check.check();

  assert.equal(result.name, "disk");
  assert.equal(result.ok, true);
});
