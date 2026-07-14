import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const EXPECTED_SCHEMAS = [
  "agentlens-agent-runtime.v1.schema.json",
  "agentlens-market-listing.v1.schema.json",
  "agentlens-model-provider.v1.schema.json",
  "agentlens-pricing-quote.v1.schema.json",
  "agentlens-search-provider.v1.schema.json",
  "agentlens-seller-submission.v1.schema.json"
];

test("public protocol schemas are valid JSON and contain no deployed credentials", async () => {
  const schemaDir = resolve(process.cwd(), "../docs/protocols/schemas");
  const names = (await readdir(schemaDir)).filter((name) => name.endsWith(".schema.json")).sort();
  assert.deepEqual(names, EXPECTED_SCHEMAS);
  const ids = new Set<string>();
  for (const name of names) {
    const source = await readFile(resolve(schemaDir, name), "utf8");
    const schema = JSON.parse(source) as Record<string, unknown>;
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(typeof schema.$id, "string");
    assert.equal(typeof schema.title, "string");
    assert.equal(ids.has(String(schema.$id)), false);
    ids.add(String(schema.$id));
    assert.doesNotMatch(source, /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?=[:/]|$)/u);
    assert.doesNotMatch(source, /\b(?:sk|tvly|ydc)-[A-Za-z0-9_-]{16,}\b/u);
    assert.doesNotMatch(source, /BEGIN [A-Z ]*PRIVATE KEY/u);
    assert.doesNotMatch(source, /\/Users\/[A-Za-z0-9._-]+\//u);
  }
});

test("seller OpenAPI contract matches the authenticated publishing and private delivery surface", async () => {
  const protocolDir = resolve(process.cwd(), "../docs/protocols");
  const source = await readFile(resolve(protocolDir, "agentlens-seller-api.v1.openapi.json"), "utf8");
  const document = JSON.parse(source) as {
    openapi?: unknown;
    servers?: Array<{ url?: unknown }>;
    paths?: Record<string, Record<string, unknown>>;
    components?: { securitySchemes?: Record<string, { name?: unknown }> };
  };
  assert.equal(document.openapi, "3.1.0");
  assert.equal(document.servers?.[0]?.url, "https://api.agentlens.example");
  assert.equal(document.components?.securitySchemes?.platformSession?.name, "__Host-agentlens_session");
  assert.ok(document.paths?.["/api/market/agents"]?.get);
  assert.ok(document.paths?.["/api/my/agents"]?.post);
  assert.ok(document.paths?.["/api/my/agents/{agentId}/source-artifacts"]?.post);
  assert.ok(document.paths?.["/api/my/agents/{agentId}/source-artifacts/{artifactId}/download"]?.get);
  assert.ok(document.paths?.["/api/my/agents/{agentId}/api-secret"]?.post);
  assert.ok(document.paths?.["/api/my/agents/{agentId}/submit"]?.post);
  assert.doesNotMatch(source, /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?=[:/]|$)/u);
  assert.doesNotMatch(source, /\b(?:sk|tvly|ydc)-[A-Za-z0-9_-]{16,}\b/u);
  assert.doesNotMatch(source, /BEGIN [A-Z ]*PRIVATE KEY/u);
});
