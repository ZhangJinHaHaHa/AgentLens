/**
 * 从链上 registry 顺序发现原生代理：自 token 1 起最多扫描十二个 ID，连续五个不存在时停止，并为每个档案尽力附加最新审计证据。
 * 输出是最小化 `AgentCatalogEntry[]` 与 idle/loading/ready/error 状态；档案不存在可跳过，审计缺失或失败保留代理，其他档案读取错误终止本轮。
 * 未注入客户端时动态创建并保存在 ref 中复用；effect 取消信号只阻止状态提交，不会取消已发 JSON-RPC，也没有结果缓存、轮询或自动重试。
 * 扫描上限和连续空洞规则是性能兼容取舍，稀疏或更大 token 空间可能暂时不可见，不能把空结果解释为链上绝对不存在。
 * RPC 档案与哈希属于外部信任边界，映射出的默认中风险、开发者缩写和“链上”标签只用于目录展示；证明有效性和工作区准入仍须服务端验证。
 * 依赖变化会复位并从 token 1 重扫；内部 ref 复用首次创建的客户端，切换网络/合约时调用方应提供新 client 或重新挂载，避免沿用旧连接。
 */
import { useEffect, useRef, useState } from "react";

import type { AgentCatalogEntry } from "@/domain/catalog";
import type { AppConfig } from "@/config/appConfig";
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

  useEffect(() => {
    const signal = { cancelled: false };
    setState({ status: "loading", agents: [], errorMessage: null });

    async function run() {
      let resolvedClient = client ?? clientRef.current;
      if (!resolvedClient) {
        const { createAgentAuditRegistryClient } = await import("@/lib/agentAuditRegistryClient");
        resolvedClient = createAgentAuditRegistryClient(config);
        clientRef.current = resolvedClient;
      }

      const agents = await loadNativeAgents(resolvedClient, signal);
      return agents;
    }

    run()
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
  }, [client, config]);

  return state;
}
