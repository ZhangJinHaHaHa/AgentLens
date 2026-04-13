import test from "node:test";
import assert from "node:assert/strict";

import { createMockTeeProvider } from "../../src/attestation/mockTeeProvider";

test("createMockTeeProvider returns deterministic attestation output for the same input", async () => {
  const provider = createMockTeeProvider();
  const input = {
    schemaVersion: "audit-attestation-request.v1" as const,
    eventKey: "0xabc:0",
    tokenId: "1",
    manifestHash: "a".repeat(64),
    evidenceRoot: "e".repeat(64),
    manifestUrl: "https://example.com/manifest.json"
  };

  const first = await provider.attest(input);
  const second = await provider.attest(input);

  assert.deepEqual(first, second);
  assert.equal(first.measurement.length, 64);
  assert.equal(first.quoteFormat, "mock-quote");
  assert.equal(typeof first.sessionPublicKey, "string");
  assert.equal(typeof first.quote, "string");
});
