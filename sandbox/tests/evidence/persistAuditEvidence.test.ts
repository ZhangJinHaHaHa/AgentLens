import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createAuditEvidenceChainContext, appendAuditEvidenceEvent } from "../../src/evidence/evidenceChain";
import { persistAuditEvidence } from "../../src/evidence/persistAuditEvidence";

function buildChain() {
  const context = createAuditEvidenceChainContext({
    eventKey: "0xabc:0",
    tokenId: 1n
  });
  appendAuditEvidenceEvent(context, {
    stage: "audit_requested_observed",
    timestamp: "2026-04-06T10:00:00.000Z",
    payload: { manifestUrl: "https://example.com/manifest.json" }
  });
  appendAuditEvidenceEvent(context, {
    stage: "manifest_fetched",
    timestamp: "2026-04-06T10:00:01.000Z",
    payload: { manifestHash: "a".repeat(64) }
  });

  return context;
}

test("persistAuditEvidence writes a deterministic evidence stream artifact", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "audit-evidence-"));
  const context = buildChain();

  const persisted = await persistAuditEvidence({
    eventKey: "0xabc:0",
    tokenId: 1n,
    chain: context,
    baseDir
  });

  assert.match(persisted.evidenceFileName, /^1-0xabc-0-[0-9a-f]{64}\.json$/);
  const payload = JSON.parse(await readFile(persisted.evidenceFilePath, "utf8")) as {
    evidenceRoot: string;
    eventCount: number;
  };
  assert.equal(payload.evidenceRoot, context.evidenceRoot);
  assert.equal(payload.eventCount, 2);
});

test("persistAuditEvidence reuses an identical existing artifact", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "audit-evidence-"));
  const context = buildChain();

  const first = await persistAuditEvidence({
    eventKey: "0xabc:0",
    tokenId: 1n,
    chain: context,
    baseDir
  });
  const second = await persistAuditEvidence({
    eventKey: "0xabc:0",
    tokenId: 1n,
    chain: context,
    baseDir
  });

  assert.equal(first.evidenceFilePath, second.evidenceFilePath);
});
