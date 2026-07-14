import test from "node:test";
import assert from "node:assert/strict";

import { validateManifest } from "../../src/manifest/schema";

test("validateManifest accepts explicit empty network allowlists", () => {
  const manifest = validateManifest({
    agent_name: "offline-agent",
    image: "registry.example.com/offline-agent:1.0.0",
    allowed_hosts: [],
    allowed_rpc_endpoints: []
  });
  assert.deepEqual(manifest.allowed_hosts, []);
  assert.deepEqual(manifest.allowed_rpc_endpoints, []);
});

test("validateManifest still requires both network allowlist fields", () => {
  assert.throws(
    () => validateManifest({ agent_name: "offline-agent", image: "registry.example.com/offline-agent:1.0.0" }),
    /allowed_hosts must be a string array/
  );
});

test("validateManifest rejects empty entries inside an allowlist", () => {
  assert.throws(
    () => validateManifest({
      agent_name: "offline-agent",
      image: "registry.example.com/offline-agent:1.0.0",
      allowed_hosts: [""],
      allowed_rpc_endpoints: []
    }),
    /allowed_hosts must only contain non-empty strings/
  );
});
