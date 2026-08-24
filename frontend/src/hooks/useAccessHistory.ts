/**
 * 读取某个 token 的租赁访问历史并把链上异步过程收敛为 loading/ready/error/unavailable 四态，输出最近记录与合约总数。
 * `tokenId` 字符串在 effect 内转换为 bigint，计数和记录并发读取；客户端缺席时不发请求并明确返回 unavailable。
 * hook 维护组件本地状态，依赖变化会清空旧结果；清理标记只阻止过期 Promise 写回，不能取消已经发出的 JSON-RPC 请求，也没有跨组件缓存。
 * token 文本和合约返回值处于浏览器/RPC 信任边界，格式错误或任一读取拒绝都会进入 error；记录客户端内部可能跳过单条失败，因此列表不等于完整账本。
 * 本层不自动重试，调用方只能通过修正 token、替换客户端或重新挂载触发新读取；访问记录用于展示，实际访问权限仍必须由合约或服务端即时判定。
 */
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
