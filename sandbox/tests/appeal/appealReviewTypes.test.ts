import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidTransition,
  assertValidTransition,
  type AppealReviewStatus
} from "../../src/appeal/appealReviewTypes";

test("isValidTransition allows pending -> under_review", () => {
  assert.equal(isValidTransition("pending", "under_review"), true);
});

test("isValidTransition allows under_review -> approved", () => {
  assert.equal(isValidTransition("under_review", "approved"), true);
});

test("isValidTransition allows under_review -> rejected", () => {
  assert.equal(isValidTransition("under_review", "rejected"), true);
});

test("isValidTransition rejects pending -> approved", () => {
  assert.equal(isValidTransition("pending", "approved"), false);
});

test("isValidTransition rejects pending -> rejected", () => {
  assert.equal(isValidTransition("pending", "rejected"), false);
});

test("isValidTransition rejects approved -> any", () => {
  const targets: AppealReviewStatus[] = ["pending", "under_review", "approved", "rejected"];

  for (const target of targets) {
    assert.equal(
      isValidTransition("approved", target),
      false,
      `approved -> ${target} should be invalid`
    );
  }
});

test("isValidTransition rejects rejected -> any", () => {
  const targets: AppealReviewStatus[] = ["pending", "under_review", "approved", "rejected"];

  for (const target of targets) {
    assert.equal(
      isValidTransition("rejected", target),
      false,
      `rejected -> ${target} should be invalid`
    );
  }
});

test("isValidTransition rejects under_review -> pending", () => {
  assert.equal(isValidTransition("under_review", "pending"), false);
});

test("assertValidTransition throws on invalid transition", () => {
  assert.throws(
    () => assertValidTransition("pending", "approved"),
    /Invalid status transition: cannot move from "pending" to "approved"/
  );
});

test("assertValidTransition does not throw on valid transition", () => {
  assert.doesNotThrow(() => assertValidTransition("pending", "under_review"));
  assert.doesNotThrow(() => assertValidTransition("under_review", "approved"));
  assert.doesNotThrow(() => assertValidTransition("under_review", "rejected"));
});
