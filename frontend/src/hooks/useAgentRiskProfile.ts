/**
 * 从 V2 合约读取六维平均分，统一百分比/基点量纲并生成场景适用性与总体风险摘要，输出组件级 loading/ready 快照。
 * 大于 100 的分数按基点除以 100，再取整夹到 0..100；非有限值归零，避免异常链值直接穿透固定阈值规则。
 * RPC 失败时采用“缺少维度”的可用性降级，仍以已有信誉生成总体风险且返回 ready；本层不缓存、不自动重试，取消标记也不会中断请求。
 * 信誉、审计次数和证明标志由调用方提供，均可能来自陈旧或不可信 RPC；生成结果是解释性展示，不能批准金融、运维等高权限场景。
 * 缺少六维分时必须保持空 strengths/weaknesses/scenarios，禁止把回退结果误绘制成已经通过审计的推荐。
 */
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
