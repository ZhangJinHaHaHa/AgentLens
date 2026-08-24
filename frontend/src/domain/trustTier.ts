/**
 * 依据编辑观察与链上证据计算可解释的 0..3 信任层级，同时输出原因和可展示证据；可选 override 用于详情页注入更新鲜的链快照。
 * 计算完全本地且不修改条目，不访问 RPC、不缓存也不重试；链读取失败和刷新策略由上层 hook/client 管理。
 * 非零报告/证明哈希在这里仅代表字段存在，并未验证原文、签名或证明有效性；所有链字段仍须来自受信 RPC/合约，层级不能充当服务端授权。
 * Tier 3 必须同时满足审计通过、两类非零哈希和信誉阈值，Tier 2 需要审计通过或证明哈希，只有编辑观察时最多为 Tier 1。
 * `trustTierHint` 只允许降级，绝不允许编辑内容提升链证据等级；无任何证据固定输出 Tier 0 与 `noEvidence`，这是防止虚假背书的核心不变量。
 * 标签函数只生成稳定 i18n key；新增层级或调整阈值属于跨数据版本的兼容变更，须与合约量纲和翻译资源同步。
 */
import type { AgentCatalogEntry, AgentChainEvidence, TrustTier } from "./catalog";
import { isNonZeroHash } from "@/lib/chainEvidence";

/**
 * Reputation threshold the chain evidence must clear before we promote an
 * agent to Tier 3. The v2 contract reports reputation in 0..1000.
 */
export const REPUTATION_TIER3_THRESHOLD = 600;

export type TrustTierReasonKey =
  | "hasObservation"
  | "hasAuditPassed"
  | "hasAttestationHash"
  | "hasReportHash"
  | "hasReputation"
  | "noEvidence";

export interface TrustTierEvidenceItem {
  key: string;
  /** Translation key under `tiers.evidence.*`. Optional — falls back to value. */
  labelKey?: string;
  value: string;
}

export interface TrustTierResult {
  tier: TrustTier;
  reasons: TrustTierReasonKey[];
  evidence: TrustTierEvidenceItem[];
}

interface TrustTierInput {
  entry: AgentCatalogEntry;
  /**
   * Optional override for chain evidence (lets the detail page feed fresher
   * data than what was merged into the catalog at load time).
   */
  chainEvidence?: AgentChainEvidence;
}

export function computeTrustTier({ entry, chainEvidence }: TrustTierInput): TrustTierResult {
  const reasons: TrustTierReasonKey[] = [];
  const evidence: TrustTierEvidenceItem[] = [];

  const chain = chainEvidence ?? entry.chainEvidence;
  const hasObservation = Boolean(entry.latestObservedAt && entry.observationSummary);

  const hasAuditPassed = Boolean(chain?.auditPassed);
  const hasReportHash = isNonZeroHash(chain?.reportHash);
  const hasAttestationHash = isNonZeroHash(chain?.attestationHash);
  const reputation = chain?.reputationScore ?? 0;
  const hasReputation = reputation >= REPUTATION_TIER3_THRESHOLD;

  if (hasObservation) {
    reasons.push("hasObservation");
    if (entry.latestObservedAt) {
      evidence.push({
        key: "observedAt",
        labelKey: "tiers.evidence.observedAt",
        value: entry.latestObservedAt
      });
    }
  }

  if (hasAuditPassed) {
    reasons.push("hasAuditPassed");
    evidence.push({ key: "auditPassed", labelKey: "tiers.evidence.auditPassed", value: "passed" });
  }
  if (hasReportHash && chain?.reportHash) {
    reasons.push("hasReportHash");
    evidence.push({
      key: "reportHash",
      labelKey: "tiers.evidence.reportHash",
      value: chain.reportHash
    });
  }
  if (hasAttestationHash && chain?.attestationHash) {
    reasons.push("hasAttestationHash");
    evidence.push({
      key: "attestationHash",
      labelKey: "tiers.evidence.attestationHash",
      value: chain.attestationHash
    });
  }
  if (hasReputation) {
    reasons.push("hasReputation");
    evidence.push({
      key: "reputation",
      labelKey: "tiers.evidence.reputation",
      value: String(reputation)
    });
  }

  let tier: TrustTier = 0;

  if (hasAuditPassed && hasReportHash && hasAttestationHash && hasReputation) {
    tier = 3;
  } else if (hasAuditPassed || hasAttestationHash) {
    tier = 2;
  } else if (hasObservation) {
    tier = 1;
  }

  // Editorial override (`trustTierHint`) can DOWNGRADE only — promoting via a
  // hint would let curated entries claim Tier 3 without chain evidence, which
  // is exactly the misuse Sprint 1.2 explicitly forbids.
  if (typeof entry.trustTierHint === "number" && entry.trustTierHint < tier) {
    tier = entry.trustTierHint;
  }

  if (reasons.length === 0) {
    reasons.push("noEvidence");
  }

  return { tier, reasons, evidence };
}

export function tierLabelKey(tier: TrustTier): string {
  return `labels.tier${tier}`;
}

export function tierShortLabelKey(tier: TrustTier): string {
  return `shortLabels.tier${tier}`;
}

export function tierDescriptionKey(tier: TrustTier): string {
  return `descriptions.tier${tier}`;
}
