import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  loadManifest,
  loadManifestFromUrl,
  ManifestValidationError
} from "../../src/manifest/loadManifest";

async function writeManifestFile(content: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "sandbox-manifest-"));
  const filePath = path.join(dir, "manifest.json");
  await writeFile(filePath, content, "utf8");
  return filePath;
}

test("loadManifest returns a normalized manifest for a valid file", async () => {
  const filePath = await writeManifestFile(
    JSON.stringify({
      agent_name: "risk-agent",
      image: "registry.example.com/agents/risk-agent:1.0.0",
      allowed_hosts: ["api.risk.com", "rpc.edge.local"],
      allowed_rpc_endpoints: ["https://rpc.edge.local"]
    })
  );

  const manifest = await loadManifest(filePath);

  assert.deepEqual(manifest, {
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com", "rpc.edge.local"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });
});

test("loadManifest throws MANIFEST_INVALID when image is missing", async () => {
  const filePath = await writeManifestFile(
    JSON.stringify({
      agent_name: "risk-agent",
      allowed_hosts: ["api.risk.com"],
      allowed_rpc_endpoints: ["https://rpc.edge.local"]
    })
  );

  await assert.rejects(
    () => loadManifest(filePath),
    (error: unknown) =>
      error instanceof ManifestValidationError &&
      error.reasonCode === "MANIFEST_INVALID" &&
      error.message.includes("image")
  );
});

test("loadManifest throws MANIFEST_INVALID when allowed_hosts contains a wildcard", async () => {
  const filePath = await writeManifestFile(
    JSON.stringify({
      agent_name: "risk-agent",
      image: "registry.example.com/agents/risk-agent:1.0.0",
      allowed_hosts: ["*.risk.com"],
      allowed_rpc_endpoints: ["https://rpc.edge.local"]
    })
  );

  await assert.rejects(
    () => loadManifest(filePath),
    (error: unknown) =>
      error instanceof ManifestValidationError &&
      error.reasonCode === "MANIFEST_INVALID" &&
      error.message.includes("allowed_hosts")
  );
});

test("loadManifest throws MANIFEST_INVALID when allowed_hosts targets the host machine alias", async () => {
  const filePath = await writeManifestFile(
    JSON.stringify({
      agent_name: "risk-agent",
      image: "registry.example.com/agents/risk-agent:1.0.0",
      allowed_hosts: ["host.docker.internal"],
      allowed_rpc_endpoints: ["https://rpc.edge.local"]
    })
  );

  await assert.rejects(
    () => loadManifest(filePath),
    (error: unknown) =>
      error instanceof ManifestValidationError &&
      error.reasonCode === "MANIFEST_INVALID" &&
      error.message.includes("allowed_hosts")
  );
});

test("loadManifest throws MANIFEST_INVALID when allowed_rpc_endpoints targets a private address", async () => {
  const filePath = await writeManifestFile(
    JSON.stringify({
      agent_name: "risk-agent",
      image: "registry.example.com/agents/risk-agent:1.0.0",
      allowed_hosts: ["api.risk.com"],
      allowed_rpc_endpoints: ["http://127.0.0.1:8545"]
    })
  );

  await assert.rejects(
    () => loadManifest(filePath),
    (error: unknown) =>
      error instanceof ManifestValidationError &&
      error.reasonCode === "MANIFEST_INVALID" &&
      error.message.includes("allowed_rpc_endpoints")
  );
});

test("loadManifest throws MANIFEST_INVALID when allowed_rpc_endpoints targets the gateway alias", async () => {
  const filePath = await writeManifestFile(
    JSON.stringify({
      agent_name: "risk-agent",
      image: "registry.example.com/agents/risk-agent:1.0.0",
      allowed_hosts: ["api.risk.com"],
      allowed_rpc_endpoints: ["https://gateway.docker.internal"]
    })
  );

  await assert.rejects(
    () => loadManifest(filePath),
    (error: unknown) =>
      error instanceof ManifestValidationError &&
      error.reasonCode === "MANIFEST_INVALID" &&
      error.message.includes("allowed_rpc_endpoints")
  );
});

test("loadManifestFromUrl returns a normalized manifest for a valid URL", async () => {
  const manifest = await loadManifestFromUrl("https://manifests.example/manifest.json", {
    fetchImpl: async (input) => {
      assert.equal(String(input), "https://manifests.example/manifest.json");
      return new Response(
        JSON.stringify({
          agent_name: "risk-agent",
          image: "registry.example.com/agents/risk-agent:1.0.0",
          allowed_hosts: ["api.risk.com"],
          allowed_rpc_endpoints: ["https://rpc.edge.local"]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }
  });

  assert.deepEqual(manifest, {
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });
});

test("loadManifestFromUrl throws MANIFEST_INVALID when the response is not valid JSON", async () => {
  await assert.rejects(
    () =>
      loadManifestFromUrl("https://manifests.example/manifest.json", {
        fetchImpl: async () =>
          new Response("{invalid-json", {
            status: 200,
            headers: { "content-type": "application/json" }
          })
      }),
    (error: unknown) =>
      error instanceof ManifestValidationError &&
      error.reasonCode === "MANIFEST_INVALID" &&
      error.message.includes("valid JSON")
  );
});

test("loadManifestFromUrl throws MANIFEST_INVALID when the server returns a non-200 response", async () => {
  await assert.rejects(
    () =>
      loadManifestFromUrl("https://manifests.example/manifest.json", {
        fetchImpl: async () =>
          new Response("temporarily unavailable", {
            status: 503,
            headers: { "content-type": "text/plain" }
          })
      }),
    (error: unknown) =>
      error instanceof ManifestValidationError &&
      error.reasonCode === "MANIFEST_INVALID" &&
      error.message.includes("HTTP 503")
  );
});

test("loadManifestFromUrl throws MANIFEST_INVALID for unsupported protocols", async () => {
  await assert.rejects(
    () => loadManifestFromUrl("ftp://example.com/manifest.json"),
    (error: unknown) =>
      error instanceof ManifestValidationError &&
      error.reasonCode === "MANIFEST_INVALID" &&
      error.message.includes("http or https")
  );
});
