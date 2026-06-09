import { useEffect, useMemo, useRef, useState } from "react";

import type { AgentCatalogEntry } from "@/domain/catalog";
import type { AppConfig } from "@/config/appConfig";
import { createAgentAuditRegistryClient } from "@/lib/agentAuditRegistryClient";
import type { AgentAuditRegistryReadContract } from "@/lib/agentAuditRegistryClient";
import { isNonZeroHash } from "@/lib/chainEvidence";
import { normalizeContractReadError } from "@/lib/normalizeContractReadError";

const SCAN_BATCH_SIZE = 12;
const MAX_CONSECUTIVE_NOT_FOUND = 5;

export type NativeAgentsStatus = "idle" | "loading" | "ready" | "error";

interface UseNativeAgentsOptions {
  config: AppConfig;
  /** Inject for testing — defaults to a real ethers client. */
  client?: AgentAuditRegistryReadContract;
}

interface UseNativeAgentsResult {
  status: NativeAgentsStatus;
  agents: AgentCatalogEntry[];
  errorMessage: string | null;
}

async function loadNativeAgents(
  client: AgentAuditRegistryReadContract,
  signal: { cancelled: boolean }
): Promise<AgentCatalogEntry[]> {
  const agents: AgentCatalogEntry[] = [];
  let consecutiveNotFound = 0;
  let currentId = 1;

  for (let i = 0; i < SCAN_BATCH_SIZE; i += 1) {
    if (signal.cancelled) break;
    const tokenId = BigInt(currentId);

    try {
      const profile = await client.getAgentProfile(tokenId);

      let auditPassed: boolean | undefined;
      let reportHash: string | undefined;
      let attestationHash: string | undefined;
      let lastAuditAt: number | undefined;

      try {
        const audit = await client.getLatestAuditReport(tokenId);
        auditPassed = Number(audit.status) === 1;
        reportHash = isNonZeroHash(audit.reportHash) ? audit.reportHash : undefined;
        attestationHash = isNonZeroHash(audit.attestationHash) ? audit.attestationHash : undefined;
        lastAuditAt = Number(audit.timestamp);
      } catch (auditError) {
        const code = normalizeContractReadError(auditError);
        if (code !== "NO_AUDIT_RECORD") {
          /* swallow — keep agent without audit info */
        }
      }

      const idString = String(currentId);
      const name = profile.agentName?.trim() || `Agent #${currentId}`;

      agents.push({
        id: idString,
        source: "native",
        name,
        vendor: profile.developer ? `${profile.developer.slice(0, 10)}…` : undefined,
        intro: {
          zh: `通过 AgentLens 链上 registry 注册的 Agent (token #${currentId})。详细信息以链上数据为准。`,
          en: `Registered on-chain via the AgentLens registry (token #${currentId}). Details follow the chain state.`
        },
        category: "Native agent",
        tags: ["on-chain", "native"],
        scenarios: [],
        unsuitableScenarios: [],
        recommendedFor: [],
        riskLevel: "medium",
        riskNotes: [
          { zh: "原生 Agent 的能力声明依赖链上注册的元数据。", en: "Native agent capabilities follow whatever the registry metadata declares." }
        ],
        accessTypes: ["api"],
        complexity: "medium",
        hasOnboardingGuide: false,
        tokenId: idString,
        chainEvidence: {
          tokenId: idString,
          auditPassed,
          reportHash,
          attestationHash,
          lastAuditAt,
          auditCount: Number(profile.auditCount)
        }
      });

      consecutiveNotFound = 0;
    } catch (error) {
      const code = normalizeContractReadError(error);
      if (code === "TOKEN_NOT_FOUND") {
        consecutiveNotFound += 1;
        if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
          break;
        }
      } else {
        throw error;
      }
    }

    currentId += 1;
  }

  return agents;
}

/**
 * Pull native agents off the chain. Designed to fail open: if the RPC is
 * unreachable we surface an error message but the caller still gets `[]` so
 * the merged catalog can fall back to curated/listed entries.
 */
export function useNativeAgents({ config, client }: UseNativeAgentsOptions): UseNativeAgentsResult {
  const [state, setState] = useState<UseNativeAgentsResult>({
    status: "idle",
    agents: [],
    errorMessage: null
  });

  const clientRef = useRef<AgentAuditRegistryReadContract | null>(null);

  const resolvedClient = useMemo<AgentAuditRegistryReadContract>(() => {
    if (client) {
      return client;
    }
    if (!clientRef.current) {
      clientRef.current = createAgentAuditRegistryClient(config);
    }
    return clientRef.current;
  }, [client, config]);

  useEffect(() => {
    const signal = { cancelled: false };
    setState({ status: "loading", agents: [], errorMessage: null });

    loadNativeAgents(resolvedClient, signal)
      .then((agents) => {
        if (signal.cancelled) return;
        setState({ status: "ready", agents, errorMessage: null });
      })
      .catch((error: unknown) => {
        if (signal.cancelled) return;
        setState({
          status: "error",
          agents: [],
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      });

    return () => {
      signal.cancelled = true;
    };
  }, [resolvedClient]);

  return state;
}
