import test from "node:test";
import assert from "node:assert/strict";

import { createInMemoryEventDeduper } from "../../src/listener/inMemoryEventDeduper";

test("createInMemoryEventDeduper claims a new event key once and rejects duplicates", () => {
  const deduper = createInMemoryEventDeduper();

  assert.equal(deduper.claim("0xabc:0"), true);
  assert.equal(deduper.claim("0xabc:0"), false);
  assert.equal(deduper.claim("0xdef:1"), true);
  assert.equal(deduper.has("0xabc:0"), true);
  assert.equal(deduper.has("0xmissing:9"), false);
});
