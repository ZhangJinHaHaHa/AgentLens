/**
 * 评价读取由两条信任边界组成：RPC 客户端读取链上评分/哈希，HTTP 客户端读取和保存与 reviewId 关联的明文评论。
 * 工厂输入为合约连接或 API base URL，输出异步方法；每次调用直接联网，无缓存、超时、取消、分页或自动重试。
 * 链上比例会转为 number 并假定量纲有界；HTTP 成功体仅靠类型断言，非成功评论列表静默为空，保存失败则从服务端 JSON 抛出错误。
 * 评论、reviewer 和 API 响应均不可信，渲染必须转义；后端须验证身份、所有权、长度及 commentHash 绑定，本客户端不会证明明文对应链上哈希。
 * 空评论列表可能是无数据或 HTTP 故障，调用方不得据此改变信誉；写入重试需由上层确认幂等性，避免重复保存。
 */
import { Contract, JsonRpcProvider, type InterfaceAbi } from "ethers";

export interface ReviewOnChain {
  reviewId: bigint;
  reviewer: string;
  timestamp: bigint;
  securityRating: number;
  taskExecutionRating: number;
  cognitiveRating: number;
  environmentRating: number;
  engineeringRating: number;
  complianceRating: number;
  commentHash: string;
}

export interface RatingDistribution {
  goodRatios: number[];
  neutralRatios: number[];
}

export interface ReviewClient {
  getReviewCount(tokenId: bigint): Promise<bigint>;
  getReview(tokenId: bigint, index: number): Promise<ReviewOnChain>;
  getRatingDistribution(tokenId: bigint): Promise<RatingDistribution>;
  hasReviewed(tokenId: bigint, reviewer: string): Promise<boolean>;
}

export interface ReviewCommentClient {
  getComments(tokenId: string): Promise<Array<{ reviewId: string; commentText: string }>>;
  saveComment(tokenId: string, reviewId: string, reviewer: string, commentText: string): Promise<void>;
}

export function createReviewClient(
  contractAddress: string,
  abi: InterfaceAbi,
  rpcUrl: string,
  chainId: number
): ReviewClient {
  const provider = new JsonRpcProvider(rpcUrl, chainId);
  const contract = new Contract(contractAddress, abi, provider);

  return {
    getReviewCount(tokenId) {
      return contract.getReviewCount(tokenId);
    },
    getReview(tokenId, index) {
      return contract.getReview(tokenId, index);
    },
    async getRatingDistribution(tokenId) {
      const result = await contract.getRatingDistribution(tokenId);
      const goodRatios = Array.from(result[0]).map(Number);
      const neutralRatios = Array.from(result[1]).map(Number);
      return { goodRatios, neutralRatios };
    },
    hasReviewed(tokenId, reviewer) {
      return contract.hasReviewed(tokenId, reviewer);
    }
  };
}

export function createReviewCommentClient(apiBaseUrl: string): ReviewCommentClient {
  const base = apiBaseUrl.replace(/\/+$/, "");

  return {
    async getComments(tokenId) {
      const response = await fetch(`${base}/api/reviews/${tokenId}/comments`);
      if (!response.ok) return [];
      const data = await response.json() as { comments: Array<{ reviewId: string; commentText: string }> };
      return data.comments;
    },

    async saveComment(tokenId, reviewId, reviewer, commentText) {
      const response = await fetch(`${base}/api/reviews/${tokenId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewId, reviewer, commentText })
      });
      if (!response.ok) {
        const data = await response.json() as { error: string };
        throw new Error(data.error);
      }
    }
  };
}
