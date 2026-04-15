import { useEffect, useState } from "react";

import type { AgentAuditRegistryReadContract, AgentProfile, AuditRecord } from "../lib/agentAuditRegistryClient";
import { getErrorMessage, normalizeContractReadError, type ContractReadErrorCode } from "../lib/normalizeContractReadError";

interface UseAgentCreditOptions {
  tokenId: bigint;
  client: AgentAuditRegistryReadContract;
}

interface UseAgentCreditState {
  status: "loading" | "ready" | "error";
  profile: AgentProfile | null;
  latestAudit: AuditRecord | null;
  errorCode: ContractReadErrorCode | null;
  errorMessage: string | null;
}

const initialState: UseAgentCreditState = {
  status: "loading",
  profile: null,
  latestAudit: null,
  errorCode: null,
  errorMessage: null
};

export function useAgentCredit({ tokenId, client }: UseAgentCreditOptions): UseAgentCreditState {
  const [state, setState] = useState<UseAgentCreditState>(initialState);

  useEffect(() => {
    let cancelled = false;

    setState(initialState);

    async function loadAgentCredit(): Promise<void> {
      const [profileResult, latestAuditResult] = await Promise.allSettled([
        client.getAgentProfile(tokenId),
        client.getLatestAuditReport(tokenId)
      ]);

      if (cancelled) {
        return;
      }

      if (profileResult.status === "rejected") {
        setState({
          status: "error",
          profile: null,
          latestAudit: null,
          errorCode: normalizeContractReadError(profileResult.reason),
          errorMessage: getErrorMessage(profileResult.reason)
        });
        return;
      }

      if (latestAuditResult.status === "rejected") {
        const errorCode = normalizeContractReadError(latestAuditResult.reason);
        if (errorCode === "NO_AUDIT_RECORD") {
          setState({
            status: "ready",
            profile: profileResult.value,
            latestAudit: null,
            errorCode,
            errorMessage: getErrorMessage(latestAuditResult.reason)
          });
          return;
        }

        setState({
          status: "error",
          profile: null,
          latestAudit: null,
          errorCode,
          errorMessage: getErrorMessage(latestAuditResult.reason)
        });
        return;
      }

      setState({
        status: "ready",
        profile: profileResult.value,
        latestAudit: latestAuditResult.value,
        errorCode: null,
        errorMessage: null
      });
    }

    void loadAgentCredit();

    return () => {
      cancelled = true;
    };
  }, [client, tokenId]);

  return state;
}
