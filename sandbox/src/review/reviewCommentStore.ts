import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface ReviewComment {
  reviewId: string;
  tokenId: string;
  reviewer: string;
  commentText: string;
  commentHash: string;
  createdAt: string;
}

interface ReviewCommentStoreData {
  comments: ReviewComment[];
}

export interface ReviewCommentStore {
  saveComment(comment: Omit<ReviewComment, "commentHash" | "createdAt">): ReviewComment;
  getCommentsByTokenId(tokenId: string): ReviewComment[];
  getCommentByHash(commentHash: string): ReviewComment | undefined;
}

export function computeCommentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function createReviewCommentStore(stateDir: string): ReviewCommentStore {
  const storeDir = path.join(stateDir, "review-comments");
  const storePath = path.join(storeDir, "comments.json");

  function readStore(): ReviewCommentStoreData {
    try {
      const raw = fs.readFileSync(storePath, "utf8");
      return JSON.parse(raw) as ReviewCommentStoreData;
    } catch {
      return { comments: [] };
    }
  }

  function writeStore(data: ReviewCommentStoreData): void {
    fs.mkdirSync(storeDir, { recursive: true });
    const tmpPath = `${storePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, storePath);
  }

  return {
    saveComment(input) {
      const commentHash = computeCommentHash(input.commentText);
      const comment: ReviewComment = {
        reviewId: input.reviewId,
        tokenId: input.tokenId,
        reviewer: input.reviewer,
        commentText: input.commentText,
        commentHash,
        createdAt: new Date().toISOString()
      };

      const data = readStore();
      data.comments.push(comment);
      writeStore(data);

      return comment;
    },

    getCommentsByTokenId(tokenId) {
      const data = readStore();
      return data.comments.filter((c) => c.tokenId === tokenId);
    },

    getCommentByHash(commentHash) {
      const data = readStore();
      return data.comments.find((c) => c.commentHash === commentHash);
    }
  };
}
