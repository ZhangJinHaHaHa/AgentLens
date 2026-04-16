import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  createReviewCommentStore,
  computeCommentHash,
  type ReviewCommentStore
} from "../../src/review/reviewCommentStore.js";

describe("reviewCommentStore", () => {
  let tmpDir: string;
  let store: ReviewCommentStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-comment-test-"));
    store = createReviewCommentStore(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves a comment and returns it with hash and createdAt", () => {
    const result = store.saveComment({
      reviewId: "1",
      tokenId: "42",
      reviewer: "0xabc",
      commentText: "Great agent!"
    });

    assert.equal(result.reviewId, "1");
    assert.equal(result.tokenId, "42");
    assert.equal(result.reviewer, "0xabc");
    assert.equal(result.commentText, "Great agent!");
    assert.equal(result.commentHash, computeCommentHash("Great agent!"));
    assert.ok(result.createdAt);
  });

  it("retrieves comments by tokenId", () => {
    store.saveComment({ reviewId: "1", tokenId: "42", reviewer: "0xabc", commentText: "Good" });
    store.saveComment({ reviewId: "2", tokenId: "42", reviewer: "0xdef", commentText: "Nice" });
    store.saveComment({ reviewId: "3", tokenId: "99", reviewer: "0xghi", commentText: "Bad" });

    const comments = store.getCommentsByTokenId("42");
    assert.equal(comments.length, 2);
    assert.equal(comments[0].commentText, "Good");
    assert.equal(comments[1].commentText, "Nice");
  });

  it("returns empty array for unknown tokenId", () => {
    const comments = store.getCommentsByTokenId("999");
    assert.deepEqual(comments, []);
  });

  it("retrieves comment by hash", () => {
    store.saveComment({ reviewId: "1", tokenId: "42", reviewer: "0xabc", commentText: "Hello world" });

    const hash = computeCommentHash("Hello world");
    const found = store.getCommentByHash(hash);
    assert.ok(found);
    assert.equal(found!.commentText, "Hello world");
  });

  it("returns undefined for unknown hash", () => {
    const found = store.getCommentByHash("nonexistenthash");
    assert.equal(found, undefined);
  });

  it("persists comments to disk", () => {
    store.saveComment({ reviewId: "1", tokenId: "42", reviewer: "0xabc", commentText: "Persisted" });

    // Create a new store from the same directory
    const store2 = createReviewCommentStore(tmpDir);
    const comments = store2.getCommentsByTokenId("42");
    assert.equal(comments.length, 1);
    assert.equal(comments[0].commentText, "Persisted");
  });

  it("computeCommentHash produces consistent SHA-256 hex", () => {
    const hash1 = computeCommentHash("test");
    const hash2 = computeCommentHash("test");
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64); // SHA-256 hex = 64 chars
  });

  it("computeCommentHash produces different hashes for different inputs", () => {
    const hash1 = computeCommentHash("hello");
    const hash2 = computeCommentHash("world");
    assert.notEqual(hash1, hash2);
  });
});
