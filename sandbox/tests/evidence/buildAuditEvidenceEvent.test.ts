import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAuditEvidenceEvent,
  computeEvidencePayloadHash,
  ZERO_EVIDENCE_HASH
} from "../../src/evidence/buildAuditEvidenceEvent";

test("computeEvidencePayloadHash stays stable for the same payload and changes with payload content", () => {
  const payload = {
    manifestUrl: "https://example.com/manifest.json",
    manifestHash: "a".repeat(64)
  };

  const first = computeEvidencePayloadHash(payload);
  const second = computeEvidencePayloadHash(payload);
  const changed = computeEvidencePayloadHash({
    ...payload,
    manifestHash: "b".repeat(64)
  });

  assert.equal(first, second);
  assert.equal(first.length, 64);
  assert.notEqual(first, changed);
});

test("buildAuditEvidenceEvent links payload hash and previous hash into a deterministic event hash", () => {
  const first = buildAuditEvidenceEvent({
    eventKey: "0xabc:0",
    tokenId: "1",
    sequence: 1,
    stage: "audit_requested_observed",
    timestamp: "2026-04-06T10:00:00.000Z",
    prevHash: ZERO_EVIDENCE_HASH,
    payload: {
      manifestUrl: "https://example.com/manifest.json"
    }
  });
  const second = buildAuditEvidenceEvent({
    eventKey: "0xabc:0",
    tokenId: "1",
    sequence: 2,
    stage: "manifest_fetched",
    timestamp: "2026-04-06T10:00:01.000Z",
    prevHash: first.eventHash,
    payload: {
      manifestHash: "a".repeat(64)
    }
  });

  assert.equal(first.sequence, 1);
  assert.equal(first.prevHash, ZERO_EVIDENCE_HASH);
  assert.equal(second.prevHash, first.eventHash);
  assert.equal(first.payloadHash.length, 64);
  assert.equal(first.eventHash.length, 64);
  assert.notEqual(first.eventHash, second.eventHash);
});
