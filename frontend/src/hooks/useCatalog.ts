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
