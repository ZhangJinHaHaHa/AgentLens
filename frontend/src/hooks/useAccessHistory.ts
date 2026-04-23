import { useEffect, useState } from "react";
import type { MarketplaceClient, AccessRecord } from "../lib/marketplaceClient";

interface UseAccessHistoryOptions {
  tokenId: string;
  marketplaceClient?: MarketplaceClient;
}

interface UseAccessHistoryResult {
  status: "loading" | "ready" | "error" | "unavailable";
  records: AccessRecord[];
  totalCount: number;
}

export function useAccessHistory({
  tokenId,
  marketplaceClient
}: UseAccessHistoryOptions): UseAccessHistoryResult {
  const [state, setState] = useState<UseAccessHistoryResult>({
    status: marketplaceClient ? "loading" : "unavailable",
    records: [],
    totalCount: 0
  });

  useEffect(() => {
    if (!marketplaceClient) {
      setState({ status: "unavailable", records: [], totalCount: 0 });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", records: [], totalCount: 0 });

    async function load() {
      if (!marketplaceClient) return;
      const id = BigInt(tokenId);
      const [count, records] = await Promise.all([
        marketplaceClient.getAccessCount(id),
        marketplaceClient.getAccessRecords(id)
      ]);
      if (!cancelled) {
        setState({ status: "ready", records, totalCount: Number(count) });
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setState({ status: "error", records: [], totalCount: 0 });
      }
    });

    return () => { cancelled = true; };
  }, [tokenId, marketplaceClient]);

  return state;
}
