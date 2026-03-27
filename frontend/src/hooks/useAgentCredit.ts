import { useEffect, useState } from "react";

import type {
  AgentAuditRegistryReadContract,
  AgentAuditRegistryV2Client,
  AgentProfile,
  AuditRecord,
  ReputationRecordOnChain
} from "../lib/agentAuditRegistryClient";
import { getErrorMessage, normalizeContractReadError, type ContractReadErrorCode } from "../lib/normalizeContractReadError";

interface UseAgentCreditOptions {
  tokenId: bigint;
  client: AgentAuditRegistryReadContract;
  v2Client?: AgentAuditRegistryV2Client;
}

interface UseAgentCreditState {
  status: "loading" | "ready" | "error";
  profile: AgentProfile | null;
  latestAudit: AuditRecord | null;
  reputation: ReputationRecordOnChain | null;
  errorCode: ContractReadErrorCode | null;
  errorMessage: string | null;
}

const initialState: UseAgentCreditState = {
  status: "loading",
  profile: null,
  latestAudit: null,
  reputation: null,
  errorCode: null,
  errorMessage: null
};

export function useAgentCredit({ tokenId, client, v2Client }: UseAgentCreditOptions): UseAgentCreditState {
  const [state, setState] = useState<UseAgentCreditState>(initialState);

  useEffect(() => {
    let cancelled = false;

    setState(initialState);

    async function loadAgentCredit(): Promise<void> {
      const settledPromises: [
        PromiseSettledResult<AgentProfile>,
        PromiseSettledResult<AuditRecord>,
        PromiseSettledResult<ReputationRecordOnChain> | null
      ] = [
        ...(await Promise.allSettled([
          client.getAgentProfile(tokenId),
          client.getLatestAuditReport(tokenId)
        ])),
        null
      ];

      if (v2Client) {
        settledPromises[2] = await Promise.allSettled([v2Client.getReputation(tokenId)]).then((r) => r[0]);
      }

      if (cancelled) {
        return;
      }

      const [profileResult, latestAuditResult] = settledPromises;
      const reputationResult = settledPromises[2];

      if (profileResult.status === "rejected") {
        setState({
          status: "error",
          profile: null,
          latestAudit: null,
          reputation: null,
          errorCode: normalizeContractReadError(profileResult.reason),
          errorMessage: getErrorMessage(profileResult.reason)
        });
        return;
      }

      const reputation = reputationResult?.status === "fulfilled" ? reputationResult.value : null;

      if (latestAuditResult.status === "rejected") {
        const errorCode = normalizeContractReadError(latestAuditResult.reason);
        if (errorCode === "NO_AUDIT_RECORD") {
          setState({
            status: "ready",
            profile: profileResult.value,
            latestAudit: null,
            reputation,
            errorCode,
            errorMessage: getErrorMessage(latestAuditResult.reason)
          });
          return;
        }

        setState({
          status: "error",
          profile: null,
          latestAudit: null,
          reputation: null,
          errorCode,
          errorMessage: getErrorMessage(latestAuditResult.reason)
        });
        return;
      }

      setState({
        status: "ready",
        profile: profileResult.value,
        latestAudit: latestAuditResult.value,
        reputation,
        errorCode: null,
        errorMessage: null
      });
    }

    void loadAgentCredit();

    return () => {
      cancelled = true;
    };
  }, [client, v2Client, tokenId]);

  return state;
}
