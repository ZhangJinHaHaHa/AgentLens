import { useEffect, useState } from "react";

import type { AgentAuditRegistryReadContract } from "../lib/agentAuditRegistryClient";
import type { AgentListEntry } from "../components/AgentListItem";
import { normalizeContractReadError } from "../lib/normalizeContractReadError";

const SCAN_BATCH_SIZE = 10;

interface UseAgentListOptions {
  client: AgentAuditRegistryReadContract;
}

interface UseAgentListState {
  status: "loading" | "ready" | "error";
  agents: AgentListEntry[];
  hasMore: boolean;
  isLoadingMore: boolean;
  nextScanId: number;
  consecutiveNotFound: number;
  errorMessage: string | null;
}

const MAX_CONSECUTIVE_NOT_FOUND = 5;

const initialState: UseAgentListState = {
  status: "loading",
  agents: [],
  hasMore: true,
  isLoadingMore: false,
  nextScanId: 1,
  consecutiveNotFound: 0,
  errorMessage: null
};

export function useAgentList({
  client
}: UseAgentListOptions): UseAgentListState & {
  loadMore: () => void;
  refresh: () => void;
} {
  const [state, setState] = useState<UseAgentListState>(initialState);

  useEffect(() => {
    let cancelled = false;

    setState(initialState);

    async function loadInitialBatch(): Promise<void> {
      const result = await scanAgentBatch({
        client,
        startId: 1,
        batchSize: SCAN_BATCH_SIZE
      });

      if (cancelled) {
        return;
      }

      setState({
        status: "ready",
        agents: result.agents,
        hasMore: result.consecutiveNotFound < MAX_CONSECUTIVE_NOT_FOUND,
        isLoadingMore: false,
        nextScanId: result.nextScanId,
        consecutiveNotFound: result.consecutiveNotFound,
        errorMessage: null
      });
    }

    void loadInitialBatch().catch((error) => {
      if (!cancelled) {
        setState({
          status: "error",
          agents: [],
          hasMore: false,
          isLoadingMore: false,
          nextScanId: 1,
          consecutiveNotFound: 0,
          errorMessage:
            error instanceof Error ? error.message : "Failed to load agent list."
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [client]);

  function loadMore(): void {
    if (state.status !== "ready" || state.isLoadingMore || !state.hasMore) {
      return;
    }

    setState((currentState) => ({
      ...currentState,
      isLoadingMore: true
    }));

    void scanAgentBatch({
      client,
      startId: state.nextScanId,
      batchSize: SCAN_BATCH_SIZE
    })
      .then((result) => {
        setState((currentState) => ({
          ...currentState,
          status: "ready",
          agents: [...currentState.agents, ...result.agents],
          hasMore: result.consecutiveNotFound < MAX_CONSECUTIVE_NOT_FOUND,
          isLoadingMore: false,
          nextScanId: result.nextScanId,
          consecutiveNotFound: result.consecutiveNotFound,
          errorMessage: null
        }));
      })
      .catch((error) => {
        setState((currentState) => ({
          ...currentState,
          isLoadingMore: false,
          errorMessage:
            error instanceof Error ? error.message : "Failed to load more agents."
        }));
      });
  }

  function refresh(): void {
    setState(initialState);
  }

  return {
    ...state,
    loadMore,
    refresh
  };
}

interface ScanAgentBatchOptions {
  client: AgentAuditRegistryReadContract;
  startId: number;
  batchSize: number;
}

interface ScanAgentBatchResult {
  agents: AgentListEntry[];
  nextScanId: number;
  consecutiveNotFound: number;
}

async function scanAgentBatch({
  client,
  startId,
  batchSize
}: ScanAgentBatchOptions): Promise<ScanAgentBatchResult> {
  const agents: AgentListEntry[] = [];
  let consecutiveNotFound = 0;
  let currentId = startId;

  for (let i = 0; i < batchSize; i += 1) {
    const tokenId = BigInt(currentId);

    try {
      const profile = await client.getAgentProfile(tokenId);

      let latestStatus: bigint | number | null = null;
      let latestScore: bigint | number | null = null;

      try {
        const latestAudit = await client.getLatestAuditReport(tokenId);
        latestStatus = latestAudit.status;
        latestScore = latestAudit.auditScore;
      } catch (auditError) {
        const errorCode = normalizeContractReadError(auditError);
        if (errorCode !== "NO_AUDIT_RECORD") {
          // Unexpected error; still include the agent without audit info
        }
      }

      agents.push({
        tokenId: String(currentId),
        agentName: profile.agentName,
        developer: profile.developer,
        latestStatus,
        latestScore,
        auditCount: profile.auditCount
      });

      consecutiveNotFound = 0;
    } catch (error) {
      const errorCode = normalizeContractReadError(error);
      if (errorCode === "TOKEN_NOT_FOUND") {
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

  return {
    agents,
    nextScanId: currentId,
    consecutiveNotFound
  };
}
