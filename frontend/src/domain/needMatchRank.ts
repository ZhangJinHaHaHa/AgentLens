import type { AgentCatalogEntry } from "./catalog";
import type { CatalogFilters } from "./filters";

interface ScoredEntry {
  entry: AgentCatalogEntry;
  index: number;
  score: number;
}

export function rankEntriesForNeed(
  entries: readonly AgentCatalogEntry[],
  filters: CatalogFilters
): AgentCatalogEntry[] {
  if (!shouldRankForNeed(filters)) {
    return [...entries];
  }

  return entries
    .map((entry, index) => ({
      entry,
      index,
      score: scoreEntry(entry, filters)
    }))
    .sort(compareScoredEntries)
    .map((item) => item.entry);
}

function shouldRankForNeed(filters: CatalogFilters): boolean {
  return (
    filters.sort === "default" &&
    filters.need.trim().length > 0 &&
    (filters.scenarios.length > 0 || filters.tags.length > 0 || filters.accessTypes.length > 0)
  );
}

function compareScoredEntries(lhs: ScoredEntry, rhs: ScoredEntry): number {
  if (lhs.score !== rhs.score) return rhs.score - lhs.score;
  return lhs.index - rhs.index;
}

function scoreEntry(entry: AgentCatalogEntry, filters: CatalogFilters): number {
  const scenarioOverlap = countOverlap(entry.scenarios.map((scenario) => scenario.id), filters.scenarios);
  const tagOverlap = countOverlap(entry.tags, filters.tags);
  const accessOverlap = countOverlap(entry.accessTypes, filters.accessTypes);
  const scenarioPrecision = ratio(scenarioOverlap, entry.scenarios.length);
  const tagPrecision = ratio(tagOverlap, entry.tags.length);

  let score = 0;
  score += scenarioOverlap * 26;
  score += tagOverlap * 34;
  score += accessOverlap * 8;
  score += scenarioPrecision * 18;
  score += tagPrecision * 14;

  if (scenarioOverlap === filters.scenarios.length && filters.scenarios.length > 0) {
    score += 16;
  }
  if (tagOverlap >= Math.min(2, filters.tags.length) && filters.tags.length > 0) {
    score += 12;
  }
  if (isGenericEntry(entry) && tagOverlap <= 1) {
    score -= 28;
  }

  return score;
}

function countOverlap(values: readonly string[], targets: readonly string[]): number {
  if (values.length === 0 || targets.length === 0) return 0;
  const valueSet = new Set(values.map((value) => value.toLowerCase()));
  return new Set(targets.map((value) => value.toLowerCase()).filter((value) => valueSet.has(value))).size;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function isGenericEntry(entry: AgentCatalogEntry): boolean {
  const tags = new Set(entry.tags.map((tag) => tag.toLowerCase()));
  return tags.has("general") || tags.has("llm") || tags.has("multimodal");
}
