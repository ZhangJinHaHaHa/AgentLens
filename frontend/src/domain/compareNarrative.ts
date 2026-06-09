import type { SupportedLocale } from "@/i18n/config";

import type { AgentCatalogEntry } from "./catalog";
import { hasAuditEvidence } from "./catalog";
import type { CompareResult } from "./compare";
import { pickText } from "./i18nText";
import { computeTrustTier } from "./trustTier";

/**
 * Plain-language compare summary — the "一句话怎么选" paragraph under the matrix.
 *
 * This is the deterministic FALLBACK generator. It reads the structured compare
 * result + entry fields and assembles a short paragraph whose length flexes with
 * how much actually differs (2 sentences when little does, more when there's a
 * clear winner + price gap + risk caveat). A future Minimax-backed provider can
 * replace this behind the same call site; keep this as the offline default.
 */
export function buildCompareNarrative(
  agents: readonly AgentCatalogEntry[],
  result: CompareResult,
  locale: SupportedLocale
): string {
  if (agents.length < 2) return "";

  const zh = locale === "zh";
  const sentences: string[] = [];
  const winner = result.winnerId ? agents.find((a) => a.id === result.winnerId) : undefined;

  // 1. Opening — anchor on a shared use-case if there is one.
  const sharedScenario = findSharedScenario(agents);
  if (sharedScenario) {
    const label = pickText(sharedScenario.label, locale);
    sentences.push(zh ? `这 ${agents.length} 个都能做「${label}」,适合放一起比。` : `All ${agents.length} can do "${label}", so they're worth comparing side by side.`);
  } else {
    sentences.push(zh ? `这 ${agents.length} 个放一起比。` : `Comparing these ${agents.length} side by side.`);
  }

  // 2. Winner — phrasing follows the deterministic conclusion.
  if (result.conclusion === "manual-judgment" || !winner) {
    sentences.push(zh ? "几个指标很接近,没有明显赢家,得看你具体看重什么。" : "Their metrics are close — no clear winner, so it comes down to what you care about most.");
  } else if (result.conclusion === "avoid-for-now") {
    sentences.push(zh ? `目前几个风险都偏高,相对稳一点的是「${winner.name}」,但建议先小范围试、别急着托付重要的事。` : `All of them carry elevated risk right now; "${winner.name}" is the steadier one, but try it in a small scope before trusting it with anything important.`);
  } else if (result.conclusion === "formal-integration") {
    sentences.push(zh ? `「${winner.name}」能力够,但${winnerWeakness(winner, locale)},适合愿意正式接入的人。` : `"${winner.name}" is capable, but ${winnerWeakness(winner, locale)} — best for someone ready to integrate it properly.`);
  } else {
    sentences.push(zh ? `综合看「${winner.name}」最稳,${winnerStrength(winner, locale)},要正式用优先它。` : `Overall "${winner.name}" is the safest pick — ${winnerStrength(winner, locale)} — reach for it first if you're committing.`);
  }

  // 3. Price — the 比价 nudge, only when there's a comparable cheapest option.
  const cheapest = findCheapest(agents);
  if (cheapest && cheapest.entry.pricingHint) {
    const price = pickText(cheapest.entry.pricingHint, locale);
    sentences.push(zh ? `想先花小钱试水,「${cheapest.entry.name}」最便宜(${price})。` : `To dip a toe in cheaply, "${cheapest.entry.name}" is the lowest cost (${price}).`);
  }

  // 4. Risk caveat — flag a high-risk agent that isn't already the headline.
  const risky = agents.find((a) => a.riskLevel === "high" && a.id !== winner?.id);
  if (risky && result.conclusion !== "avoid-for-now") {
    sentences.push(zh ? `「${risky.name}」风险偏高,别一上来就交给它关键的事。` : `"${risky.name}" runs higher risk — don't hand it anything critical on day one.`);
  }

  // 5. Closing nudge — only when trying is genuinely low-stakes.
  if (cheapest && result.conclusion !== "avoid-for-now") {
    sentences.push(zh ? "好在单次试用成本不高,先试一个,不合适再换,沉没成本很低。" : "Trying one is cheap, so start with one and switch if it doesn't fit — the sunk cost is low.");
  }

  return sentences.join(zh ? "" : " ");
}

function winnerStrength(entry: AgentCatalogEntry, locale: SupportedLocale): string {
  const zh = locale === "zh";
  if (computeTrustTier({ entry }).tier >= 2) return zh ? "信任等级最高" : "it has the highest trust tier";
  if (hasAuditEvidence(entry)) return zh ? "有审计证据" : "it has audit evidence on record";
  if (entry.riskLevel === "low") return zh ? "风险最低" : "it carries the lowest risk";
  if (entry.hasOnboardingGuide) return zh ? "有上手指南" : "it ships an onboarding guide";
  return zh ? "综合最均衡" : "it has the most balanced profile";
}

function winnerWeakness(entry: AgentCatalogEntry, locale: SupportedLocale): string {
  const zh = locale === "zh";
  if (entry.riskLevel === "high") return zh ? "风险偏高" : "it runs higher risk";
  if (entry.complexity === "high") return zh ? "接入有点复杂" : "it's more complex to wire up";
  if (!entry.hasOnboardingGuide) return zh ? "没有上手指南" : "it lacks an onboarding guide";
  return zh ? "需要一点接入成本" : "it takes some setup";
}

interface PricedAgent {
  entry: AgentCatalogEntry;
  price: number;
}

/** Lowest comparable absolute price, or undefined when none are comparable. */
function findCheapest(agents: readonly AgentCatalogEntry[]): PricedAgent | undefined {
  const priced: PricedAgent[] = [];
  for (const entry of agents) {
    const price = parsePrice(entry);
    if (price !== null) priced.push({ entry, price });
  }
  if (priced.length < 2) return undefined; // nothing to compare on price
  return priced.reduce((min, cur) => (cur.price < min.price ? cur : min));
}

/**
 * Parse a comparable absolute price from a freeform pricing hint. Only counts a
 * value when an explicit currency symbol is present — "20% of salary" or
 * "no win no fee" style hints are not directly comparable and return null.
 */
function parsePrice(entry: AgentCatalogEntry): number | null {
  const hint = entry.pricingHint;
  if (!hint) return null;
  const text = `${hint.zh} ${hint.en}`;
  const match = text.match(/[¥$]\s*([\d,]+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function findSharedScenario(agents: readonly AgentCatalogEntry[]) {
  const [first, ...rest] = agents;
  if (!first) return undefined;
  return first.scenarios.find((scenario) =>
    rest.every((agent) => agent.scenarios.some((s) => s.id === scenario.id))
  );
}
