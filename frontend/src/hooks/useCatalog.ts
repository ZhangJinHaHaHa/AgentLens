/**
 * 组装前端可消费的统一目录：将打包的 curated/marketplace 数据与链上 native 读取结果合并，并暴露 native 加载状态和错误。
 * `nativeAgents` 可注入确定性快照，`skipNative` 用空客户端维持 Hook 调用顺序并避免真实 RPC，适合 SSR、截图和测试路径。
 * 合并结果通过 `useMemo` 仅按依赖引用做渲染期缓存，不持久化；实际网络与取消语义由 `useNativeAgents` 拥有，失败时静态目录仍可展示。
 * 静态卖家声明和链上元数据都不是浏览器可信授权，返回的 Map、来源分组与状态只服务发现页面，工作区准入必须使用显式 gate 并由服务端复核。
 * native 覆盖优先于 hook 结果，skip 模式固定报告 idle；这些优先级是测试与服务端渲染兼容不变量，不能因错误状态而删除静态条目。
 */
import { useMemo } from "react";

import { curatedAgents } from "@/data/catalog/curated";
import { marketplaceAgents } from "@/data/catalog/marketplace";
import type { AgentCatalogEntry, MergedCatalog } from "@/domain/catalog";
import { mergeCatalog } from "@/domain/catalog";
import type { AppConfig } from "@/config/appConfig";

import { useNativeAgents, type NativeAgentsStatus } from "./useNativeAgents";

interface UseCatalogOptions {
  config: AppConfig;
  /** Inject for testing — defaults to a real ethers client. */
  nativeAgents?: AgentCatalogEntry[];
  /** Skip the on-chain fetch entirely (e.g. for SSR/snapshot). */
  skipNative?: boolean;
}

export interface UseCatalogResult extends MergedCatalog {
  nativeStatus: NativeAgentsStatus;
  nativeError: string | null;
}

const NOOP_NATIVE_CLIENT = createNoopClient();

export function useCatalog({ config, nativeAgents, skipNative }: UseCatalogOptions): UseCatalogResult {
  const native = useNativeAgents({
    config,
    client: skipNative ? NOOP_NATIVE_CLIENT : undefined
  });

  const merged = useMemo(() => {
    const sourceNative = nativeAgents ?? (skipNative ? [] : native.agents);
    return mergeCatalog({
      curated: curatedAgents,
      listed: [],
      marketplace: marketplaceAgents,
      native: sourceNative
    });
  }, [native.agents, nativeAgents, skipNative]);

  return {
    ...merged,
    nativeStatus: skipNative ? "idle" : native.status,
    nativeError: native.errorMessage
  };
}

function createNoopClient() {
  return {
    async getAgentProfile() {
      throw new Error("TOKEN_NOT_FOUND: native fetching disabled");
    },
    async getLatestAuditReport() {
      throw new Error("NO_AUDIT_RECORD");
    },
    async getAuditCount() {
      return 0n;
    },
    async getAuditReportByIndex() {
      throw new Error("NO_AUDIT_RECORD");
    }
  };
}
