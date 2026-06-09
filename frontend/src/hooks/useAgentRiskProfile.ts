import { useEffect, useState } from "react";

import type { AgentAuditRegistryV2Client, DimensionalScoresOnChain } from "../lib/agentAuditRegistryClient";
import { generateRiskProfile, type DimensionalInput, type RiskProfileSummary } from "../lib/sceneSuitability";

interface UseAgentRiskProfileOptions {
  tokenId: bigint;
  v2Client: AgentAuditRegistryV2Client;
  reputationScore: number;
  auditCount: number;
  attestationVerified: boolean;
}

interface UseAgentRiskProfileState {
  status: "loading" | "ready" | "error";
  averageScores: DimensionalScoresOnChain | null;
  riskProfile: RiskProfileSummary | null;
  errorMessage: string | null;
}

const initialState: UseAgentRiskProfileState = {
  status: "loading",
  averageScores: null,
  riskProfile: null,
  errorMessage: null
};

export function normalizeBasisPointScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  const percentScore = score > 100 ? score / 100 : score;
  return Math.max(0, Math.min(100, Math.round(percentScore)));
}

function toDimensionalInput(scores: DimensionalScoresOnChain): DimensionalInput {
  return {
    security: normalizeBasisPointScore(scores.security),
    taskExecution: normalizeBasisPointScore(scores.taskExecution),
    cognitive: normalizeBasisPointScore(scores.cognitive),
    environment: normalizeBasisPointScore(scores.environment),
    engineering: normalizeBasisPointScore(scores.engineering),
    compliance: normalizeBasisPointScore(scores.compliance)
  };
}

export function useAgentRiskProfile({
  tokenId,
  v2Client,
  reputationScore,
  auditCount,
  attestationVerified
}: UseAgentRiskProfileOptions): UseAgentRiskProfileState {
  const [state, setState] = useState<UseAgentRiskProfileState>(initialState);

  useEffect(() => {
    let cancelled = false;

    setState(initialState);

    async function load(): Promise<void> {
      try {
        const averageScores = await v2Client.getAverageScores(tokenId);

        if (cancelled) return;

        const riskProfile = generateRiskProfile(
          toDimensionalInput(averageScores),
          reputationScore,
          auditCount,
          attestationVerified
        );

        setState({
          status: "ready",
          averageScores,
          riskProfile,
          errorMessage: null
        });
      } catch (error) {
        if (cancelled) return;

        // Generate profile without dimensional scores
        const riskProfile = generateRiskProfile(
          null,
          reputationScore,
          auditCount,
          attestationVerified
        );

        setState({
          status: "ready",
          averageScores: null,
          riskProfile,
          errorMessage: null
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [tokenId, v2Client, reputationScore, auditCount, attestationVerified]);

  return state;
}
