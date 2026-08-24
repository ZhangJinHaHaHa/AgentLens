/**
 * 聚合代理档案、最新审计和可选 V2 信誉为详情页信用状态；输入是规范化 bigint token 与只读合约客户端，输出一个组件本地快照。
 * 档案和审计并发读取，信誉独立容错：档案失败为致命错误，明确的无审计记录仍返回 ready，信誉读取失败则只降级为 `null`。
 * 每次依赖变化先复位 loading，effect 清理只抑制旧请求落地而不终止 RPC；没有持久缓存、退避或自动重试，恢复依赖重新触发读取。
 * 错误分类依赖合约 revert 消息的兼容字符串，未知错误不得被当成“无记录”；RPC 返回的地址、分数和状态只供展示，服务端授权应重新查询权威链状态。
 * PromiseSettled 的部分成功策略是页面可用性不变量，新增字段时不得让可选扩展失败抹掉已成功的基础档案。
 */
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
