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
