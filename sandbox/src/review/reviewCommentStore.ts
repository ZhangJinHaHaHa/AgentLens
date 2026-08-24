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
  // 接口以字符串 tokenId 保持 JSON/API 兼容；调用方负责在进入存储前规范化链上整数表示。
  saveComment(comment: Omit<ReviewComment, "commentHash" | "createdAt">): ReviewComment;
  getCommentsByTokenId(tokenId: string): ReviewComment[];
  getCommentByHash(commentHash: string): ReviewComment | undefined;
}

export function computeCommentHash(text: string): string {
  // 哈希针对 UTF-8 正文字节，适合稳定查找和完整性比对；它无密钥，不能证明 reviewer 身份或授权。
  return createHash("sha256").update(text).digest("hex");
}

export function createReviewCommentStore(stateDir: string): ReviewCommentStore {
  // 该实例的持久状态由单个 comments.json 拥有；闭包不保留内存副本，每次操作都重新读取磁盘快照。
  const storeDir = path.join(stateDir, "review-comments");
  const storePath = path.join(storeDir, "comments.json");

  function readStore(): ReviewCommentStoreData {
    try {
      const raw = fs.readFileSync(storePath, "utf8");
      // 类型断言不执行 schema 校验；旧版本文件必须继续保持 { comments: [...] } 形状才能被当前实现消费。
      return JSON.parse(raw) as ReviewCommentStoreData;
    } catch {
      // 现有兼容行为把“文件不存在、损坏或不可读”统一视为空库；写操作随后可能覆盖坏文件，运维需外部监控目录健康。
      return { comments: [] };
    }
  }

  function writeStore(data: ReviewCommentStoreData): void {
    fs.mkdirSync(storeDir, { recursive: true });
    // 同目录临时文件再 rename 避免单次写入暴露半截 JSON；未 fsync，因此不承诺断电后的介质级持久性。
    const tmpPath = `${storePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, storePath);
  }

  return {
    saveComment(input) {
      // commentHash 与 createdAt 由存储边界生成，调用方不能伪造这两个派生字段。
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
      // 追加没有唯一键检查，属于非幂等写入；固定 .tmp 名和“读-改-写”也要求单进程串行使用，否则会丢更新。
      data.comments.push(comment);
      writeStore(data);

      return comment;
    },

    getCommentsByTokenId(tokenId) {
      const data = readStore();
      // 返回的是本次 JSON 解析产生的新对象；调用方修改结果不会回写持久状态。
      return data.comments.filter((c) => c.tokenId === tokenId);
    },

    getCommentByHash(commentHash) {
      const data = readStore();
      return data.comments.find((c) => c.commentHash === commentHash);
    }
  };
}
