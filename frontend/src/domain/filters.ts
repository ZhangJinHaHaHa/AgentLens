import type {
  AccessType,
  AgentCatalogEntry,
  AgentSource,
  Complexity,
  RiskLevel,
  TrustTier
} from "./catalog";
import { hasAuditEvidence, isRentable } from "./catalog";
import { SCENARIO_IDS } from "@/data/catalog/scenarios";
import { computeTrustTier } from "./trustTier";

export type SortKey = "default" | "newest" | "trust" | "risk" | "complexity";
export type PriceMode = "free" | "paid" | "rentable" | "unknown";
export type AuditStatusFilter = "passed" | "failed" | "pending" | "no-audit";
export type ScoreBand = "high" | "medium" | "low" | "unknown";

export interface CatalogFilters {
  query: string;
  need: string;
  scenarios: string[];
  tags: string[];
  categories: string[];
  sources: AgentSource[];
  accessTypes: AccessType[];
  trustTiers: TrustTier[];
  riskLevels: RiskLevel[];
  complexities: Complexity[];
  priceModes: PriceMode[];
  auditStatuses: AuditStatusFilter[];
  scoreBands: ScoreBand[];
  hasOnboarding: boolean;
  hasAudit: boolean;
  rentable: boolean;
  sort: SortKey;
}

export type FilterChipKind =
  | "query"
  | "need"
  | "scenario"
  | "tag"
  | "category"
  | "source"
  | "access"
  | "trustTier"
  | "risk"
  | "complexity"
  | "price"
  | "auditStatus"
  | "score"
  | "hasOnboarding"
  | "hasAudit"
  | "rentable"
  | "sort";

export interface FilterChip {
  id: string;
  kind: FilterChipKind;
  value: string | number | boolean;
}

export interface FilterRelaxationSuggestion {
  chip: FilterChip;
  filters: CatalogFilters;
  resultCount: number;
}

export interface CatalogFacets {
  scenarioIds: string[];
  sources: AgentSource[];
  accessTypes: AccessType[];
  trustTiers: TrustTier[];
  riskLevels: RiskLevel[];
  complexities: Complexity[];
  tags: string[];
  categories: string[];
  priceModes: PriceMode[];
  auditStatuses: AuditStatusFilter[];
  scoreBands: ScoreBand[];
  toggles: {
    hasOnboarding: boolean;
    hasAudit: boolean;
    rentable: boolean;
  };
}

export const CATALOG_FILTER_SEARCH_PARAM_KEYS = [
  "q",
  "need",
  "scenario",
  "tag",
  "category",
  "source",
  "access",
  "tier",
  "risk",
  "complexity",
  "price",
  "auditStatus",
  "score",
  "onboarding",
  "audit",
  "rentable",
  "sort"
] as const;

export const EMPTY_FILTERS: CatalogFilters = {
  query: "",
  need: "",
  scenarios: [],
  tags: [],
  categories: [],
  sources: [],
  accessTypes: [],
  trustTiers: [],
  riskLevels: [],
  complexities: [],
  priceModes: [],
  auditStatuses: [],
  scoreBands: [],
  hasOnboarding: false,
  hasAudit: false,
  rentable: false,
  sort: "default"
};

export function filtersAreEmpty(filters: CatalogFilters): boolean {
  return (
    !filters.query &&
    !filters.need &&
    filters.scenarios.length === 0 &&
    filters.tags.length === 0 &&
    filters.categories.length === 0 &&
    filters.sources.length === 0 &&
    filters.accessTypes.length === 0 &&
    filters.trustTiers.length === 0 &&
    filters.riskLevels.length === 0 &&
    filters.complexities.length === 0 &&
    filters.priceModes.length === 0 &&
    filters.auditStatuses.length === 0 &&
    filters.scoreBands.length === 0 &&
    !filters.hasOnboarding &&
    !filters.hasAudit &&
    !filters.rentable &&
    (filters.sort === "default" || filters.sort === undefined)
  );
}

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
const COMPLEXITY_ORDER: Record<Complexity, number> = { low: 0, medium: 1, high: 2 };
const SOURCE_FACET_ORDER: AgentSource[] = ["marketplace", "curated", "listed", "native"];
const ACCESS_FACET_ORDER: AccessType[] = ["api", "saas", "cli", "browser_ext", "local", "cloud"];
const TRUST_TIER_FACET_ORDER: TrustTier[] = [3, 2, 1, 0];
const RISK_FACET_ORDER: RiskLevel[] = ["low", "medium", "high"];
const COMPLEXITY_FACET_ORDER: Complexity[] = ["low", "medium", "high"];
const PRICE_FACET_ORDER: PriceMode[] = ["free", "paid", "rentable", "unknown"];
const AUDIT_STATUS_FACET_ORDER: AuditStatusFilter[] = ["passed", "failed", "pending", "no-audit"];
const SCORE_BAND_FACET_ORDER: ScoreBand[] = ["high", "medium", "low", "unknown"];
const TOP_TAG_MIN_COUNT = 2;

export function buildCatalogFacets(entries: readonly AgentCatalogEntry[]): CatalogFacets {
  const scenarioCounts = new Map<string, number>();
  const sourceCounts = new Map<AgentSource, number>();
  const accessCounts = new Map<AccessType, number>();
  const tierCounts = new Map<TrustTier, number>();
  const riskCounts = new Map<RiskLevel, number>();
  const complexityCounts = new Map<Complexity, number>();
  const tagCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const priceCounts = new Map<PriceMode, number>();
  const auditStatusCounts = new Map<AuditStatusFilter, number>();
  const scoreCounts = new Map<ScoreBand, number>();

  let hasOnboarding = false;
  let hasAudit = false;
  let rentable = false;

  for (const entry of entries) {
    increment(sourceCounts, entry.source);
    increment(riskCounts, entry.riskLevel);
    increment(complexityCounts, entry.complexity);
    increment(tierCounts, computeTrustTier({ entry }).tier);
    increment(categoryCounts, normalizeCategory(entry.category));
    increment(priceCounts, getPriceMode(entry));
    increment(auditStatusCounts, getAuditStatusFilter(entry));
    increment(scoreCounts, getScoreBand(entry));

    for (const scenario of entry.scenarios) {
      increment(scenarioCounts, scenario.id);
    }
    for (const accessType of entry.accessTypes) {
      increment(accessCounts, accessType);
    }
    for (const tag of entry.tags) {
      increment(tagCounts, tag.trim().toLowerCase());
    }

    hasOnboarding ||= entry.hasOnboardingGuide;
    hasAudit ||= hasAuditEvidence(entry);
    rentable ||= isRentable(entry);
  }

  return {
    scenarioIds: withCount(SCENARIO_IDS, scenarioCounts),
    sources: withCount(SOURCE_FACET_ORDER, sourceCounts),
    accessTypes: withCount(ACCESS_FACET_ORDER, accessCounts),
    trustTiers: withCount(TRUST_TIER_FACET_ORDER, tierCounts),
    riskLevels: withCount(RISK_FACET_ORDER, riskCounts),
    complexities: withCount(COMPLEXITY_FACET_ORDER, complexityCounts),
    tags: Array.from(tagCounts.entries())
      .filter(([, count]) => count >= TOP_TAG_MIN_COUNT)
      .sort(([lhs, lhsCount], [rhs, rhsCount]) => rhsCount - lhsCount || lhs.localeCompare(rhs))
      .map(([tag]) => tag),
    categories: Array.from(categoryCounts.keys()).sort(),
    priceModes: withCount(PRICE_FACET_ORDER, priceCounts),
    auditStatuses: withCount(AUDIT_STATUS_FACET_ORDER, auditStatusCounts),
    scoreBands: withCount(SCORE_BAND_FACET_ORDER, scoreCounts),
    toggles: {
      hasOnboarding,
      hasAudit,
      rentable
    }
  };
}

function increment<T>(map: Map<T, number>, key: T): void {
  if (typeof key === "string" && key.trim().length === 0) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function withCount<T>(options: readonly T[], counts: Map<T, number>): T[] {
  return options.filter((option) => (counts.get(option) ?? 0) > 0);
}

function matchesQuery(entry: AgentCatalogEntry, query: string): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  if (entry.name.toLowerCase().includes(needle)) return true;
  if (entry.vendor?.toLowerCase().includes(needle)) return true;
  if (entry.intro.zh.toLowerCase().includes(needle)) return true;
  if (entry.intro.en.toLowerCase().includes(needle)) return true;
  if (entry.tags.some((tag) => tag.toLowerCase().includes(needle))) return true;
  if (entry.recommendedFor.some((item) => matchesText(item.zh, needle) || matchesText(item.en, needle))) return true;
  if (entry.riskNotes.some((item) => matchesText(item.zh, needle) || matchesText(item.en, needle))) return true;
  if (entry.riskMitigation?.some((item) => matchesText(item.zh, needle) || matchesText(item.en, needle))) return true;
  if (
    entry.observationSummary &&
    (matchesText(entry.observationSummary.zh, needle) || matchesText(entry.observationSummary.en, needle))
  ) {
    return true;
  }
  if (
    entry.scenarios.some(
      (s) =>
        s.id.toLowerCase().includes(needle) ||
        s.label.zh.toLowerCase().includes(needle) ||
        s.label.en.toLowerCase().includes(needle)
    )
  ) {
    return true;
  }
  if (entry.category.toLowerCase().includes(needle)) return true;
  return false;
}

function matchesText(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle);
}

function matchesScenarios(entry: AgentCatalogEntry, scenarios: string[]): boolean {
  if (scenarios.length === 0) return true;
  const ids = new Set(entry.scenarios.map((s) => s.id));
  return scenarios.some((id) => ids.has(id));
}

function matchesTags(entry: AgentCatalogEntry, tags: string[]): boolean {
  if (tags.length === 0) return true;
  const set = new Set(entry.tags.map((tag) => tag.toLowerCase()));
  return tags.some((value) => set.has(value.toLowerCase()));
}

function matchesCategories(entry: AgentCatalogEntry, categories: string[]): boolean {
  if (categories.length === 0) return true;
  return categories.includes(normalizeCategory(entry.category));
}

function matchesSource(entry: AgentCatalogEntry, sources: AgentSource[]): boolean {
  if (sources.length === 0) return true;
  return sources.includes(entry.source);
}

function matchesAccess(entry: AgentCatalogEntry, accessTypes: AccessType[]): boolean {
  if (accessTypes.length === 0) return true;
  const set = new Set(entry.accessTypes);
  return accessTypes.some((value) => set.has(value));
}

function matchesTrust(entry: AgentCatalogEntry, tiers: TrustTier[]): boolean {
  if (tiers.length === 0) return true;
  const tier = computeTrustTier({ entry }).tier;
  return tiers.includes(tier);
}

function matchesRisk(entry: AgentCatalogEntry, levels: RiskLevel[]): boolean {
  if (levels.length === 0) return true;
  return levels.includes(entry.riskLevel);
}

function matchesComplexity(entry: AgentCatalogEntry, levels: Complexity[]): boolean {
  if (levels.length === 0) return true;
  return levels.includes(entry.complexity);
}

function matchesOnboarding(entry: AgentCatalogEntry, required: boolean): boolean {
  return !required || entry.hasOnboardingGuide;
}

function matchesAudit(entry: AgentCatalogEntry, required: boolean): boolean {
  if (!required) return true;
  return hasAuditEvidence(entry);
}

function matchesRentable(entry: AgentCatalogEntry, required: boolean): boolean {
  if (!required) return true;
  return isRentable(entry);
}

function matchesPriceMode(entry: AgentCatalogEntry, modes: PriceMode[]): boolean {
  if (modes.length === 0) return true;
  return modes.includes(getPriceMode(entry));
}

function matchesAuditStatus(entry: AgentCatalogEntry, statuses: AuditStatusFilter[]): boolean {
  if (statuses.length === 0) return true;
  return statuses.includes(getAuditStatusFilter(entry));
}

function matchesScoreBand(entry: AgentCatalogEntry, bands: ScoreBand[]): boolean {
  if (bands.length === 0) return true;
  return bands.includes(getScoreBand(entry));
}

export function applyFilters(
  entries: readonly AgentCatalogEntry[],
  filters: CatalogFilters
): AgentCatalogEntry[] {
  const filtered = entries.filter(
    (entry) =>
      matchesQuery(entry, filters.query) &&
      matchesScenarios(entry, filters.scenarios) &&
      matchesTags(entry, filters.tags) &&
      matchesCategories(entry, filters.categories) &&
      matchesSource(entry, filters.sources) &&
      matchesAccess(entry, filters.accessTypes) &&
      matchesTrust(entry, filters.trustTiers) &&
      matchesRisk(entry, filters.riskLevels) &&
      matchesComplexity(entry, filters.complexities) &&
      matchesPriceMode(entry, filters.priceModes) &&
      matchesAuditStatus(entry, filters.auditStatuses) &&
      matchesScoreBand(entry, filters.scoreBands) &&
      matchesOnboarding(entry, filters.hasOnboarding) &&
      matchesAudit(entry, filters.hasAudit) &&
      matchesRentable(entry, filters.rentable)
  );

  return sortEntries(filtered, filters.sort);
}

export function getActiveFilterChips(filters: CatalogFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.query.trim()) chips.push({ id: "query", kind: "query", value: filters.query });
  if (filters.need.trim()) chips.push({ id: "need", kind: "need", value: filters.need });
  chips.push(...filters.scenarios.map((value) => ({ id: `scenario:${value}`, kind: "scenario" as const, value })));
  chips.push(...filters.tags.map((value) => ({ id: `tag:${value}`, kind: "tag" as const, value })));
  chips.push(...filters.categories.map((value) => ({ id: `category:${value}`, kind: "category" as const, value })));
  chips.push(...filters.sources.map((value) => ({ id: `source:${value}`, kind: "source" as const, value })));
  chips.push(...filters.accessTypes.map((value) => ({ id: `access:${value}`, kind: "access" as const, value })));
  chips.push(...filters.trustTiers.map((value) => ({ id: `tier:${value}`, kind: "trustTier" as const, value })));
  chips.push(...filters.riskLevels.map((value) => ({ id: `risk:${value}`, kind: "risk" as const, value })));
  chips.push(...filters.complexities.map((value) => ({ id: `complexity:${value}`, kind: "complexity" as const, value })));
  chips.push(...filters.priceModes.map((value) => ({ id: `price:${value}`, kind: "price" as const, value })));
  chips.push(...filters.auditStatuses.map((value) => ({ id: `auditStatus:${value}`, kind: "auditStatus" as const, value })));
  chips.push(...filters.scoreBands.map((value) => ({ id: `score:${value}`, kind: "score" as const, value })));
  if (filters.hasOnboarding) chips.push({ id: "hasOnboarding", kind: "hasOnboarding", value: true });
  if (filters.hasAudit) chips.push({ id: "hasAudit", kind: "hasAudit", value: true });
  if (filters.rentable) chips.push({ id: "rentable", kind: "rentable", value: true });
  if (filters.sort && filters.sort !== "default") chips.push({ id: `sort:${filters.sort}`, kind: "sort", value: filters.sort });
  return chips;
}

export function removeFilterChip(filters: CatalogFilters, chip: FilterChip): CatalogFilters {
  switch (chip.kind) {
    case "query":
      return { ...filters, query: "" };
    case "need":
      return { ...filters, need: "" };
    case "scenario":
      return { ...filters, scenarios: filters.scenarios.filter((value) => value !== chip.value) };
    case "tag":
      return { ...filters, tags: filters.tags.filter((value) => value !== chip.value) };
    case "category":
      return { ...filters, categories: filters.categories.filter((value) => value !== chip.value) };
    case "source":
      return { ...filters, sources: filters.sources.filter((value) => value !== chip.value) };
    case "access":
      return { ...filters, accessTypes: filters.accessTypes.filter((value) => value !== chip.value) };
    case "trustTier":
      return { ...filters, trustTiers: filters.trustTiers.filter((value) => value !== chip.value) };
    case "risk":
      return { ...filters, riskLevels: filters.riskLevels.filter((value) => value !== chip.value) };
    case "complexity":
      return { ...filters, complexities: filters.complexities.filter((value) => value !== chip.value) };
    case "price":
      return { ...filters, priceModes: filters.priceModes.filter((value) => value !== chip.value) };
    case "auditStatus":
      return { ...filters, auditStatuses: filters.auditStatuses.filter((value) => value !== chip.value) };
    case "score":
      return { ...filters, scoreBands: filters.scoreBands.filter((value) => value !== chip.value) };
    case "hasOnboarding":
      return { ...filters, hasOnboarding: false };
    case "hasAudit":
      return { ...filters, hasAudit: false };
    case "rentable":
      return { ...filters, rentable: false };
    case "sort":
      return { ...filters, sort: "default" };
  }
}

export function suggestFilterRelaxation(
  entries: readonly AgentCatalogEntry[],
  filters: CatalogFilters
): FilterRelaxationSuggestion | null {
  const chips = getActiveFilterChips(filters);
  if (chips.length === 0) return null;

  let best: FilterRelaxationSuggestion | null = null;
  for (const chip of chips) {
    const relaxed = removeFilterChip(filters, chip);
    const resultCount = applyFilters(entries, relaxed).length;
    if (!best || resultCount > best.resultCount) {
      best = { chip, filters: relaxed, resultCount };
    }
  }

  return best;
}

export function sortEntries(entries: AgentCatalogEntry[], sort: SortKey): AgentCatalogEntry[] {
  if (sort === "default") return entries;

  const arr = [...entries];

  switch (sort) {
    case "newest":
      arr.sort((a, b) => {
        const lhs = (a.latestObservedAt ?? "0000-00-00").localeCompare(b.latestObservedAt ?? "0000-00-00");
        return -lhs;
      });
      break;
    case "trust":
      arr.sort((a, b) => computeTrustTier({ entry: b }).tier - computeTrustTier({ entry: a }).tier);
      break;
    case "risk":
      arr.sort((a, b) => RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel]);
      break;
    case "complexity":
      arr.sort((a, b) => COMPLEXITY_ORDER[a.complexity] - COMPLEXITY_ORDER[b.complexity]);
      break;
  }

  return arr;
}

export interface UrlFilterEncoding {
  query?: string;
  need?: string;
  scenarios?: string[];
  tags?: string[];
  sources?: string[];
  accessTypes?: string[];
  trustTiers?: number[];
  riskLevels?: string[];
  complexities?: string[];
  categories?: string[];
  priceModes?: string[];
  auditStatuses?: string[];
  scoreBands?: string[];
  hasOnboarding?: boolean;
  hasAudit?: boolean;
  rentable?: boolean;
  sort?: SortKey;
}

export function filtersToSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.need) params.set("need", filters.need);
  if (filters.scenarios.length) params.set("scenario", filters.scenarios.join(","));
  if (filters.tags.length) params.set("tag", filters.tags.join(","));
  if (filters.categories.length) params.set("category", filters.categories.join(","));
  if (filters.sources.length) params.set("source", filters.sources.join(","));
  if (filters.accessTypes.length) params.set("access", filters.accessTypes.join(","));
  if (filters.trustTiers.length) params.set("tier", filters.trustTiers.join(","));
  if (filters.riskLevels.length) params.set("risk", filters.riskLevels.join(","));
  if (filters.complexities.length) params.set("complexity", filters.complexities.join(","));
  if (filters.priceModes.length) params.set("price", filters.priceModes.join(","));
  if (filters.auditStatuses.length) params.set("auditStatus", filters.auditStatuses.join(","));
  if (filters.scoreBands.length) params.set("score", filters.scoreBands.join(","));
  if (filters.hasOnboarding) params.set("onboarding", "1");
  if (filters.hasAudit) params.set("audit", "1");
  if (filters.rentable) params.set("rentable", "1");
  if (filters.sort && filters.sort !== "default") params.set("sort", filters.sort);
  return params;
}

export function mergeFiltersToSearchParams(current: URLSearchParams, filters: CatalogFilters): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of CATALOG_FILTER_SEARCH_PARAM_KEYS) {
    next.delete(key);
  }

  const filterParams = filtersToSearchParams(filters);
  filterParams.forEach((value, key) => {
    next.set(key, value);
  });

  return next;
}

export function searchParamsToFilters(params: URLSearchParams): CatalogFilters {
  const sortRaw = params.get("sort");
  const allowedSort: SortKey[] = ["default", "newest", "trust", "risk", "complexity"];
  const sort = allowedSort.includes(sortRaw as SortKey) ? (sortRaw as SortKey) : "default";

  return {
    query: params.get("q") ?? "",
    need: params.get("need") ?? "",
    scenarios: splitCsv(params.get("scenario")),
    tags: splitCsv(params.get("tag")),
    categories: splitCsv(params.get("category")).map(normalizeCategory),
    sources: splitCsv(params.get("source")) as AgentSource[],
    accessTypes: splitCsv(params.get("access")) as AccessType[],
    trustTiers: splitCsv(params.get("tier"))
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => [0, 1, 2, 3].includes(value)) as TrustTier[],
    riskLevels: splitCsv(params.get("risk")) as RiskLevel[],
    complexities: splitCsv(params.get("complexity")) as Complexity[],
    priceModes: allowValues(splitCsv(params.get("price")), PRICE_FACET_ORDER),
    auditStatuses: allowValues(splitCsv(params.get("auditStatus")), AUDIT_STATUS_FACET_ORDER),
    scoreBands: allowValues(splitCsv(params.get("score")), SCORE_BAND_FACET_ORDER),
    hasOnboarding: params.get("onboarding") === "1",
    hasAudit: params.get("audit") === "1",
    rentable: params.get("rentable") === "1",
    sort
  };
}

function splitCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function allowValues<T extends string>(values: string[], allowed: readonly T[]): T[] {
  const allowedSet = new Set<string>(allowed);
  return values.filter((value): value is T => allowedSet.has(value));
}

function normalizeCategory(value: string): string {
  return value.trim().toLowerCase();
}

export function getPriceMode(entry: AgentCatalogEntry): PriceMode {
  if (isRentable(entry)) return "rentable";
  const label = `${entry.pricingHint?.zh ?? ""} ${entry.pricingHint?.en ?? ""} ${entry.nativePricing?.label?.zh ?? ""} ${entry.nativePricing?.label?.en ?? ""}`.toLowerCase();
  if (!label.trim() && !entry.pricingUrl) return "unknown";
  if (/\bfree\b|免费|试用/.test(label)) return "free";
  return "paid";
}

export function getAuditStatusFilter(entry: AgentCatalogEntry): AuditStatusFilter {
  const chain = entry.chainEvidence;
  if (!chain) return "no-audit";
  if (chain.auditPassed === true) return "passed";
  if (chain.auditPassed === false && hasAuditEvidence(entry)) return "failed";
  if (chain.auditPassed === false) return "failed";
  if (hasAuditEvidence(entry) || typeof chain.auditCount === "number") return "pending";
  return "no-audit";
}

export function getScoreBand(entry: AgentCatalogEntry): ScoreBand {
  const tier = computeTrustTier({ entry }).tier;
  if (tier >= 3) return "high";
  if (tier === 2) return "medium";
  if (tier === 1 || hasAuditEvidence(entry)) return "low";
  return "unknown";
}
