import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { appendAuditEvidenceEvent, createAuditEvidenceChainContext } from "../../src/evidence/evidenceChain";
import { persistAuditEvidence } from "../../src/evidence/persistAuditEvidence";
import { readPersistedAuditEvidence } from "../../src/evidence/readPersistedAuditEvidence";

async function writeValidArtifact(baseDir: string, eventKey = "0xabc:0") {
  const context = createAuditEvidenceChainContext({
    eventKey,
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

  return persistAuditEvidence({
    eventKey,
    tokenId: 1n,
    chain: context,
    baseDir
  });
}

test("readPersistedAuditEvidence verifies a persisted evidence stream", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "audit-evidence-read-"));
  const persisted = await writeValidArtifact(baseDir);

  const result = await readPersistedAuditEvidence({
    eventKey: "0xabc:0",
    baseDir
  });

  assert.deepEqual(result, {
    status: "verified",
    eventKey: "0xabc:0",
    evidenceFilePath: persisted.evidenceFilePath,
    evidenceRoot: persisted.evidenceRoot
  });
});

test("readPersistedAuditEvidence returns hash_mismatch when persisted bytes are tampered", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "audit-evidence-read-"));
  const persisted = await writeValidArtifact(baseDir, "0xabc:7");
  await writeFile(
    persisted.evidenceFilePath,
    JSON.stringify({
      schemaVersion: "audit-evidence-stream.v1",
      eventKey: "0xabc:7",
      tokenId: "1",
      eventCount: 1,
      evidenceRoot: persisted.evidenceRoot,
      events: []
    }),
    "utf8"
  );

  const result = await readPersistedAuditEvidence({
    eventKey: "0xabc:7",
    baseDir
  });

  assert.equal(result.status, "hash_mismatch");
});
