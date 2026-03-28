import { useEffect, useState } from "react";

import type { AgentAuditRegistryReadContract, AuditRecord } from "../lib/agentAuditRegistryClient";
import { getErrorMessage, normalizeContractReadError, type ContractReadErrorCode } from "../lib/normalizeContractReadError";

const PAGE_SIZE = 10;

interface UseAuditHistoryOptions {
  tokenId: bigint;
  client: AgentAuditRegistryReadContract;
}

interface UseAuditHistoryState {
  status: "loading" | "ready" | "error";
  records: AuditRecord[];
  totalCount: number;
  hasMore: boolean;
  nextIndex: number;
  isLoadingMore: boolean;
  errorCode: ContractReadErrorCode | null;
  errorMessage: string | null;
}

const initialState: UseAuditHistoryState = {
  status: "loading",
  records: [],
  totalCount: 0,
  hasMore: false,
  nextIndex: -1,
  isLoadingMore: false,
  errorCode: null,
  errorMessage: null
};

export function useAuditHistory({
  tokenId,
  client
}: UseAuditHistoryOptions): UseAuditHistoryState & { loadMore: () => Promise<void> } {
  const [state, setState] = useState<UseAuditHistoryState>(initialState);

  useEffect(() => {
    let cancelled = false;

    setState(initialState);

    async function loadInitialHistory(): Promise<void> {
      try {
        const auditCount = toSafeNumber(await client.getAuditCount(tokenId));
        if (auditCount === 0) {
          if (!cancelled) {
            setState({
              status: "ready",
              records: [],
              totalCount: 0,
              hasMore: false,
              nextIndex: -1,
              isLoadingMore: false,
              errorCode: null,
              errorMessage: null
            });
          }
          return;
        }

        const { records, nextIndex } = await loadAuditWindow({
          tokenId,
          client,
          startIndex: auditCount - 1
        });

        if (cancelled) {
          return;
        }

        setState({
          status: "ready",
          records,
          totalCount: auditCount,
          hasMore: nextIndex >= 0,
          nextIndex,
          isLoadingMore: false,
          errorCode: null,
          errorMessage: null
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          status: "error",
          records: [],
          totalCount: 0,
          hasMore: false,
          nextIndex: -1,
          isLoadingMore: false,
          errorCode: normalizeContractReadError(error),
          errorMessage: getErrorMessage(error)
        });
      }
    }

    void loadInitialHistory();

    return () => {
      cancelled = true;
    };
  }, [client, tokenId]);

  async function loadMore(): Promise<void> {
    if (state.status !== "ready" || state.isLoadingMore || !state.hasMore) {
      return;
    }

    setState((currentState) => ({
      ...currentState,
      isLoadingMore: true
    }));

    try {
      const { records, nextIndex } = await loadAuditWindow({
        tokenId,
        client,
        startIndex: state.nextIndex
      });

      setState((currentState) => ({
        ...currentState,
        status: "ready",
        records: [...currentState.records, ...records],
        hasMore: nextIndex >= 0,
        nextIndex,
        isLoadingMore: false,
        errorCode: null,
        errorMessage: null
      }));
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        status: "error",
        isLoadingMore: false,
        errorCode: normalizeContractReadError(error),
        errorMessage: getErrorMessage(error)
      }));
    }
  }

  return {
    ...state,
    loadMore
  };
}

async function loadAuditWindow({
  tokenId,
  client,
  startIndex
}: {
  tokenId: bigint;
  client: AgentAuditRegistryReadContract;
  startIndex: number;
}): Promise<{ records: AuditRecord[]; nextIndex: number }> {
  if (startIndex < 0) {
    return {
      records: [],
      nextIndex: -1
    };
  }

  const endIndex = Math.max(startIndex - (PAGE_SIZE - 1), 0);
  const records: AuditRecord[] = [];

  for (let index = startIndex; index >= endIndex; index -= 1) {
    records.push(await client.getAuditReportByIndex(tokenId, index));
  }

  return {
    records,
    nextIndex: endIndex - 1
  };
}

function toSafeNumber(value: bigint): number {
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue) || numberValue < 0) {
    throw new Error("Invalid audit count.");
  }

  return numberValue;
}
