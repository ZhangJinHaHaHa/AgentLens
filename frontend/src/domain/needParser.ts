import type {
  AccessType,
  AgentCatalogEntry,
  Complexity,
  RiskLevel
} from "./catalog";
import { EMPTY_FILTERS, type CatalogFilters } from "./filters";

export interface NeedParserTaxonomy {
  scenarioIds: string[];
  tags: string[];
  accessTypes: AccessType[];
  riskLevels: RiskLevel[];
  complexities: Complexity[];
}

export interface NeedParseResult {
  scenarioIds: string[];
  tags: string[];
  accessTypes: AccessType[];
  riskLevels: RiskLevel[];
  complexities: Complexity[];
  hasAudit: boolean;
  hasOnboarding: boolean;
  confidence: number;
  unmatchedTerms: string[];
}

export function buildNeedParserTaxonomy(entries: readonly AgentCatalogEntry[]): NeedParserTaxonomy {
  return {
    scenarioIds: unique(entries.flatMap((entry) => entry.scenarios.map((scenario) => scenario.id))),
    tags: unique(entries.flatMap((entry) => entry.tags)),
    accessTypes: unique(entries.flatMap((entry) => entry.accessTypes)) as AccessType[],
    riskLevels: unique(entries.map((entry) => entry.riskLevel)) as RiskLevel[],
    complexities: unique(entries.map((entry) => entry.complexity)) as Complexity[]
  };
}

export function parseNeedParserResponse(raw: string, taxonomy: NeedParserTaxonomy): NeedParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("LLM parse response must be JSON.");
  }

  if (!isRecord(parsed)) {
    throw new Error("LLM parse response must be a JSON object.");
  }

  return {
    scenarioIds: allowlistedStrings(parsed.scenarioIds, taxonomy.scenarioIds),
    tags: allowlistedStrings(parsed.tags, taxonomy.tags),
    accessTypes: allowlistedStrings(parsed.accessTypes, taxonomy.accessTypes) as AccessType[],
    riskLevels: allowlistedStrings(parsed.riskLevels, taxonomy.riskLevels) as RiskLevel[],
    complexities: allowlistedStrings(parsed.complexities, taxonomy.complexities) as Complexity[],
    hasAudit: parsed.hasAudit === true,
    hasOnboarding: parsed.hasOnboarding === true,
    confidence: normalizeConfidence(parsed.confidence),
    unmatchedTerms: stringArray(parsed.unmatchedTerms).slice(0, 8)
  };
}

export function toFiltersFromNeedParse(result: NeedParseResult, originalNeed: string): CatalogFilters {
  const need = originalNeed.trim();
  return {
    ...EMPTY_FILTERS,
    query: "",
    need,
    scenarios: result.scenarioIds,
    tags: result.tags,
    accessTypes: result.accessTypes,
    riskLevels: hasExplicitRiskNeed(need) ? result.riskLevels : [],
    complexities: hasExplicitComplexityNeed(need) ? result.complexities : [],
    hasAudit: result.hasAudit && hasExplicitAuditNeed(need),
    hasOnboarding: result.hasOnboarding && hasExplicitOnboardingNeed(need)
  };
}

function hasExplicitAuditNeed(value: string): boolean {
  return /审计|审核|验证|可验证|可信|attestation|audit|verified|verifiable/i.test(value);
}

function hasExplicitOnboardingNeed(value: string): boolean {
  return /上手指南|上手教程|教程|指南|getting started|onboarding|guide|tutorial/i.test(value);
}

function hasExplicitRiskNeed(value: string): boolean {
  return /风险|安全|低风险|高风险|risk|safe|safety/i.test(value);
}

function hasExplicitComplexityNeed(value: string): boolean {
  return /简单|容易|低复杂度|高复杂度|复杂|轻量|simple|easy|complex|complexity/i.test(value);
}

function allowlistedStrings(value: unknown, allowed: readonly string[]): string[] {
  const allowedSet = new Set(allowed);
  return unique(stringArray(value)).filter((item) => allowedSet.has(item));
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
