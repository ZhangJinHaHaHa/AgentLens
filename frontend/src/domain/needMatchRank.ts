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
    (
      filters.query.trim().length > 0 ||
      (
        filters.need.trim().length > 0 &&
        (filters.scenarios.length > 0 || filters.tags.length > 0 || filters.accessTypes.length > 0)
      )
    )
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

  return score + scoreQueryMatch(entry, filters.query);
}

function scoreQueryMatch(entry: AgentCatalogEntry, query: string): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  const tokens = needle.split(/[\s,;:/|，。；、]+/u).filter((token) => token.length >= 2);
  const fragments = collectWeightedQueryFragments(entry);

  let score = 0;
  for (const fragment of fragments) {
    if (fragment.value.includes(needle)) {
      score += fragment.weight * 3;
    }
    for (const token of tokens) {
      if (fragment.value.includes(token)) {
        score += fragment.weight;
      }
    }
  }
  return score;
}

function collectWeightedQueryFragments(entry: AgentCatalogEntry): Array<{ value: string; weight: number }> {
  const highWeight = [
    { value: entry.name, weight: 40 },
    { value: entry.vendor ?? "", weight: 10 },
    { value: entry.category, weight: 18 },
    { value: entry.intro.zh, weight: 22 },
    { value: entry.intro.en, weight: 22 },
    ...(entry.tagline ? [
      { value: entry.tagline.zh, weight: 22 },
      { value: entry.tagline.en, weight: 22 }
    ] : []),
    ...entry.tags.map((value) => ({ value, weight: 24 })),
    ...entry.recommendedFor.flatMap((item) => [
      { value: item.zh, weight: 22 },
      { value: item.en, weight: 22 }
    ]),
    ...entry.scenarios.flatMap((scenario) => [
      { value: scenario.id, weight: 16 },
      { value: scenario.label.zh, weight: 18 },
      { value: scenario.label.en, weight: 18 }
    ])
  ];
  const lowWeight = [
    ...entry.riskNotes.flatMap((item) => [
      { value: item.zh, weight: 3 },
      { value: item.en, weight: 3 }
    ]),
    ...(entry.riskMitigation?.flatMap((item) => [
      { value: item.zh, weight: 3 },
      { value: item.en, weight: 3 }
    ]) ?? []),
    ...(entry.observationSummary
      ? [
          { value: entry.observationSummary.zh, weight: 2 },
          { value: entry.observationSummary.en, weight: 2 }
        ]
      : [])
  ];
  return [...highWeight, ...lowWeight]
    .map((fragment) => ({ ...fragment, value: fragment.value.toLowerCase() }))
    .filter((fragment) => fragment.value.length > 0);
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
