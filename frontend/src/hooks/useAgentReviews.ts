import { useEffect, useState } from "react";

import type { ReviewClient, ReviewCommentClient, ReviewOnChain, RatingDistribution } from "../lib/reviewClient";
import type { MarketplaceClient } from "../lib/marketplaceClient";

interface ReviewData {
  reviewer: string;
  timestamp: string;
  ratings: number[];  // 0=Bad, 1=Neutral, 2=Good
  commentText?: string;
}

interface UseAgentReviewsOptions {
  tokenId: string;
  userAddress?: string;
  reviewClient?: ReviewClient;
  commentClient?: ReviewCommentClient;
  marketplaceClient?: MarketplaceClient;
}

interface UseAgentReviewsState {
  status: "loading" | "ready" | "error";
  distribution: RatingDistribution;
  reviews: ReviewData[];
  hasAccess: boolean;
  hasReviewed: boolean;
  errorMessage: string | null;
}

const initialState: UseAgentReviewsState = {
  status: "loading",
  distribution: { goodRatios: [0, 0, 0, 0, 0, 0], neutralRatios: [0, 0, 0, 0, 0, 0] },
  reviews: [],
  hasAccess: false,
  hasReviewed: false,
  errorMessage: null
};

export function useAgentReviews({
  tokenId,
  userAddress,
  reviewClient,
  commentClient,
  marketplaceClient
}: UseAgentReviewsOptions): UseAgentReviewsState {
  const [state, setState] = useState<UseAgentReviewsState>(initialState);

  useEffect(() => {
    let cancelled = false;

    if (!reviewClient) {
      setState({ ...initialState, status: "ready" });
      return;
    }

    setState(initialState);

    async function loadReviews(): Promise<void> {
      try {
        const tid = BigInt(tokenId);
        const [distribution, reviewCount] = await Promise.all([
          reviewClient!.getRatingDistribution(tid),
          reviewClient!.getReviewCount(tid)
        ]);

        if (cancelled) return;

        const count = Number(reviewCount);
        const reviewPromises: Promise<ReviewOnChain>[] = [];
        for (let i = 0; i < count; i++) {
          reviewPromises.push(reviewClient!.getReview(tid, i));
        }

        const onChainReviews = await Promise.all(reviewPromises);
        if (cancelled) return;

        const comments = commentClient
          ? await commentClient.getComments(tokenId)
          : [];
        if (cancelled) return;

        const commentMap = new Map(comments.map((c) => [c.reviewId, c.commentText]));

        const reviews: ReviewData[] = onChainReviews.map((r) => ({
          reviewer: r.reviewer,
          timestamp: new Date(Number(r.timestamp) * 1000).toISOString(),
          ratings: [
            r.securityRating,
            r.taskExecutionRating,
            r.cognitiveRating,
            r.environmentRating,
            r.engineeringRating,
            r.complianceRating
          ],
          commentText: commentMap.get(String(r.reviewId))
        }));

        let hasAccess = false;
        let hasReviewed = false;

        if (userAddress) {
          const [accessResult, reviewedResult] = await Promise.allSettled([
            marketplaceClient ? marketplaceClient.hasAccess(tid, userAddress) : Promise.resolve(false),
            reviewClient!.hasReviewed(tid, userAddress)
          ]);

          hasAccess = accessResult.status === "fulfilled" ? accessResult.value : false;
          hasReviewed = reviewedResult.status === "fulfilled" ? reviewedResult.value : false;
        }

        if (cancelled) return;

        setState({
          status: "ready",
          distribution,
          reviews,
          hasAccess,
          hasReviewed,
          errorMessage: null
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          ...initialState,
          status: "error",
          errorMessage: err instanceof Error ? err.message : String(err)
        });
      }
    }

    void loadReviews();

    return () => {
      cancelled = true;
    };
  }, [tokenId, userAddress, reviewClient, commentClient, marketplaceClient]);

  return state;
}
