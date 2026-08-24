/**
 * 为详情页并行读取 marketplace 的每日价格配置和访问次数，输出允许部分缺失的定价快照；无客户端时显式标记 unavailable。
 * 两项合约读取使用 `allSettled` 相互隔离，单项失败会变成对应 `null` 而页面仍 ready，避免统计故障遮蔽可用价格。
 * 状态仅属于当前 hook 实例，依赖变化会重新加载；取消标记不终止在途 JSON-RPC，模块也不缓存、轮询或自动重试。
 * token、价格和计数来自浏览器所连 RPC，可能陈旧或超出安全数值范围；它们只能驱动展示，付款金额与访问授权必须在签名/合约边界重验。
 * 捕获到 effect 级异常时保留 ready 与错误文本，调用方应呈现数据不可用而不是猜测为免费；重新连接或刷新由上层触发。
 */
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
