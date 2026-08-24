/**
 * 对至少两个目录条目执行可复现的比较决策，并另行计算各展示维度是否存在差异；返回的是推荐结论和可选赢家 ID，而非交易指令。
 * 评分组合信任层级、风险、复杂度、上手资料、审计证据和可租赁性；分差不足、样本不足或高风险缺证据时主动转为人工判断/暂缓。
 * 计算过程不修改输入、不读写缓存也不触发网络，排序与集合比较均基于当前快照；链上刷新和失败重试属于调用方职责。
 * 条目中的链证据及卖家字段可能陈旧或未经验证，比较结果只能辅助界面选择，服务端仍须独立执行准入、余额、权限和审计校验。
 * 少于两个输入固定返回 `manual-judgment`，同分排序保持原输入次序；分差小于两分时不宣布赢家，防止微小元数据变化制造确定性承诺。
 */
import type { AgentCatalogEntry, Complexity, RiskLevel } from "./catalog";
import { getRuntimeSecurity, hasAuditEvidence, isRentable } from "./catalog";
import { computeTrustTier } from "./trustTier";

export type CompareConclusion =
  | "try-first"
  | "formal-integration"
  | "avoid-for-now"
  | "manual-judgment";

export type CompareAttributeKey =
  | "scenario"
  | "unsuitableScenario"
  | "seller"
  | "complexity"
  | "riskLevel"
  | "trustTier"
  | "runtimeSecurity"
  | "onboarding"
  | "auditEvidence"
  | "pricing"
  | "officialRoute";

export interface CompareResult {
  conclusion: CompareConclusion;
  winnerId?: string;
}

export type CompareAttributeDiffs = Record<CompareAttributeKey, boolean>;

interface ScoredAgent {
  entry: AgentCatalogEntry;
  score: number;
  tier: number;
  hasAudit: boolean;
}

const riskScore: Record<RiskLevel, number> = {
  low: 4,
  medium: 1,
  high: -4
};

const complexityScore: Record<Complexity, number> = {
  low: 3,
  medium: 1,
  high: -2
};

function scoreAgent(entry: AgentCatalogEntry): ScoredAgent {
  const trust = computeTrustTier({ entry });
  const hasAudit = hasAuditEvidence(entry);
  const score =
    trust.tier * 3 +
    riskScore[entry.riskLevel] +
    complexityScore[entry.complexity] +
    (entry.hasOnboardingGuide ? 2 : 0) +
    (hasAudit ? 2 : 0) +
    (isRentable(entry) ? 1 : 0);

  return { entry, score, tier: trust.tier, hasAudit };
}

function isTooRiskyWithoutEvidence(agent: ScoredAgent): boolean {
  return agent.entry.riskLevel === "high" && agent.tier < 2 && !agent.hasAudit;
}

function needsFormalIntegration(agent: ScoredAgent): boolean {
  return (
    agent.entry.riskLevel === "high" ||
    agent.entry.complexity === "high" ||
    !agent.entry.hasOnboardingGuide ||
    agent.tier >= 2
  );
}

export function compareAgents(agents: readonly AgentCatalogEntry[]): CompareResult {
  if (agents.length < 2) {
    return { conclusion: "manual-judgment" };
  }

  const ranked = agents.map(scoreAgent).sort((a, b) => b.score - a.score);
  const [best, second] = ranked;

  if (!best) {
    return { conclusion: "manual-judgment" };
  }

  const allTooRisky = ranked.every(isTooRiskyWithoutEvidence);
  if (allTooRisky) {
    return { conclusion: "avoid-for-now", winnerId: best.entry.id };
  }

  if (second && best.score - second.score < 2) {
    return { conclusion: "manual-judgment" };
  }

  if (isTooRiskyWithoutEvidence(best)) {
    return { conclusion: "avoid-for-now", winnerId: best.entry.id };
  }

  if (needsFormalIntegration(best)) {
    return { conclusion: "formal-integration", winnerId: best.entry.id };
  }

  return { conclusion: "try-first", winnerId: best.entry.id };
}

export function getCompareAttributeDiffs(
  agents: readonly AgentCatalogEntry[]
): CompareAttributeDiffs {
  return {
    scenario: valuesDiffer(agents.map((entry) => idsKey(entry.scenarios.map((item) => item.id)))),
    unsuitableScenario: valuesDiffer(
      agents.map((entry) => idsKey(entry.unsuitableScenarios.map((item) => item.id)))
    ),
    seller: valuesDiffer(
      agents.map((entry) => `${entry.seller?.kind ?? ""}|${entry.seller?.label.en ?? entry.seller?.label.zh ?? ""}`)
    ),
    complexity: valuesDiffer(agents.map((entry) => entry.complexity)),
    riskLevel: valuesDiffer(agents.map((entry) => entry.riskLevel)),
    trustTier: valuesDiffer(agents.map((entry) => String(computeTrustTier({ entry }).tier))),
    runtimeSecurity: valuesDiffer(agents.map((entry) => getRuntimeSecurity(entry).kind)),
    onboarding: valuesDiffer(agents.map((entry) => String(entry.hasOnboardingGuide))),
    auditEvidence: valuesDiffer(agents.map((entry) => String(hasAuditEvidence(entry)))),
    pricing: valuesDiffer(
      agents.map((entry) => entry.pricingHint?.en ?? entry.pricingHint?.zh ?? entry.nativePricing?.label?.en ?? "")
    ),
    officialRoute: valuesDiffer(agents.map((entry) => entry.officialUrl ?? ""))
  };
}

function idsKey(values: readonly string[]): string {
  return [...values].sort().join("|");
}

function valuesDiffer(values: readonly string[]): boolean {
  if (values.length < 2) return false;
  return new Set(values).size > 1;
}
