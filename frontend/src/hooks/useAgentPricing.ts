import { useEffect, useState } from "react";

import type { MarketplaceClient } from "../lib/marketplaceClient";

interface UseAgentPricingOptions {
  tokenId: bigint;
  marketplaceClient: MarketplaceClient | null;
}

interface UseAgentPricingState {
  status: "loading" | "ready" | "unavailable";
  pricing: {
    pricePerDay: bigint;
    buyPrice: bigint;
    configured: boolean;
  } | null;
  accessCount: number | null;
  errorMessage: string | null;
}

export function useAgentPricing({
  tokenId,
  marketplaceClient
}: UseAgentPricingOptions): UseAgentPricingState {
  const [state, setState] = useState<UseAgentPricingState>({
    status: marketplaceClient ? "loading" : "unavailable",
    pricing: null,
    accessCount: null,
    errorMessage: null
  });

  useEffect(() => {
    if (!marketplaceClient) {
      setState({ status: "unavailable", pricing: null, accessCount: null, errorMessage: null });
      return;
    }

    let cancelled = false;

    async function load(): Promise<void> {
      const results = await Promise.allSettled([
        marketplaceClient!.getPricing(tokenId),
        marketplaceClient!.getAccessCount(tokenId)
      ]);

      if (cancelled) return;

      const pricingResult = results[0];
      const accessResult = results[1];

      setState({
        status: "ready",
        pricing: pricingResult.status === "fulfilled" ? pricingResult.value : null,
        accessCount: accessResult.status === "fulfilled" ? Number(accessResult.value) : null,
        errorMessage: null
      });
    }

    setState({ status: "loading", pricing: null, accessCount: null, errorMessage: null });
    void load().catch((error) => {
      if (!cancelled) {
        setState({
          status: "ready",
          pricing: null,
          accessCount: null,
          errorMessage: error instanceof Error ? error.message : "Failed to load pricing."
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tokenId, marketplaceClient]);

  return state;
}
