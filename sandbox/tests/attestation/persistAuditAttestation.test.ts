import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildAuditAttestationArtifact,
  computeAuditAttestationHash
} from "../../src/attestation/buildAuditAttestation";
import { persistAuditAttestation } from "../../src/attestation/persistAuditAttestation";

test("buildAuditAttestationArtifact computes a stable attestation hash from bundle json", () => {
  const bundle = {
    schemaVersion: "audit-attestation.v1" as const,
    eventKey: "0xabc:0",
    tokenId: "1",
    manifestHash: "a".repeat(64),
    evidenceRoot: "e".repeat(64),
    verifier: {
      type: "mock-tee",
      measurement: "m".repeat(64),
      quoteFormat: "mock-quote",
      sessionPublicKey: "spk-123",
      quote: "quote-abc"
    }
  };

  const first = buildAuditAttestationArtifact(bundle);
  const second = buildAuditAttestationArtifact(bundle);

  assert.equal(first.attestationHash, second.attestationHash);
  assert.equal(first.attestationHash, computeAuditAttestationHash(first.bundleJson));
});

test("persistAuditAttestation writes a deterministic local bundle", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "audit-attestation-"));
  const artifact = buildAuditAttestationArtifact({
    schemaVersion: "audit-attestation.v1",
    eventKey: "0xabc:0",
    tokenId: "1",
    manifestHash: "a".repeat(64),
    evidenceRoot: "e".repeat(64),
    verifier: {
      type: "mock-tee",
      measurement: "m".repeat(64),
      quoteFormat: "mock-quote",
      sessionPublicKey: "spk-123",
      quote: "quote-abc"
    }
  });

  const persisted = await persistAuditAttestation({
    eventKey: "0xabc:0",
    tokenId: 1n,
    attestationArtifact: artifact,
    baseDir
  });

  assert.match(persisted.attestationFileName, /^1-0xabc-0-[0-9a-f]{64}\.json$/);
  assert.equal(await readFile(persisted.attestationFilePath, "utf8"), artifact.bundleJson);
});
