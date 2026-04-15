import test from "node:test";
import assert from "node:assert/strict";

import {
  appendAuditEvidenceEvent,
  createAuditEvidenceChainContext
} from "../../src/evidence/evidenceChain";

test("appendAuditEvidenceEvent increments sequence numbers and updates evidenceRoot", () => {
  const context = createAuditEvidenceChainContext({
    eventKey: "0xabc:0",
    tokenId: 1n
  });

  const first = appendAuditEvidenceEvent(context, {
    stage: "audit_requested_observed",
    timestamp: "2026-04-06T10:00:00.000Z",
    payload: { manifestUrl: "https://example.com/manifest.json" }
  });
  const second = appendAuditEvidenceEvent(context, {
    stage: "manifest_fetched",
    timestamp: "2026-04-06T10:00:01.000Z",
    payload: { manifestHash: "a".repeat(64) }
  });

  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
  assert.equal(second.prevHash, first.eventHash);
  assert.equal(context.events.length, 2);
  assert.equal(context.evidenceRoot, second.eventHash);
});
