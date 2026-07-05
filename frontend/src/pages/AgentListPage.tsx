import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useSearchParams } from "react-router-dom";

import { AgentList } from "@/components/agent/AgentList";
import { SearchFilterBar } from "@/components/agent/SearchFilterBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading } from "@/components/layout/PageHeading";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppConfig } from "@/config/appConfig";
import { useCatalog } from "@/hooks/useCatalog";
import {
  EMPTY_FILTERS,
  applyFilters,
  buildCatalogFacets,
  filtersAreEmpty,
  mergeFiltersToSearchParams,
  searchParamsToFilters,
  suggestFilterRelaxation,
  type FilterChip,
  type CatalogFilters
} from "@/domain/filters";
import { getAgentProductType } from "@/domain/catalog";
import { rankEntriesForNeed } from "@/domain/needMatchRank";
import { buildNeedParserTaxonomy, toFiltersFromNeedParse } from "@/domain/needParser";
import { SCENARIO_MAP } from "@/data/catalog/scenarios";
import { pickText } from "@/domain/i18nText";
import { useLocale } from "@/i18n/useLocale";
import { parseNeedWithLlm } from "@/lib/needParserClient";

interface AgentListPageProps {
  config: AppConfig;
}

export function AgentListPage({ config }: AgentListPageProps): JSX.Element {
  const { t } = useTranslation("agents");
  const { locale } = useLocale();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = useMemo(() => searchParamsToFilters(searchParams), []);
  const [filters, setFilters] = useState<CatalogFilters>(initialFilters);
  const [semanticParseError, setSemanticParseError] = useState("");
  const lastSemanticQueryRef = useRef("");

  const { entries, nativeStatus } = useCatalog({ config });
  const agentEntries = useMemo(
    () => entries.filter((entry) => getAgentProductType(entry) !== "large_model_assistant"),
    [entries]
  );
  const facets = useMemo(() => buildCatalogFacets(agentEntries), [agentEntries]);
  const taxonomy = useMemo(() => buildNeedParserTaxonomy(agentEntries), [agentEntries]);
  const filtered = useMemo(
    () => rankEntriesForNeed(applyFilters(agentEntries, filters), filters),
    [agentEntries, filters]
  );
  const relaxationSuggestion = useMemo(
    () => suggestFilterRelaxation(agentEntries, filters),
    [agentEntries, filters]
  );
  const emptyScenarioSuggestions = useMemo(
    () => facets.scenarioIds.filter((id) => !filters.scenarios.includes(id)).slice(0, 3),
    [facets.scenarioIds, filters.scenarios]
  );
  const llmNeedParserUnavailable =
    searchParams.get("llm") === "unavailable" ||
    (typeof location.state === "object" &&
      location.state !== null &&
      "llmNeedParserUnavailable" in location.state &&
      location.state.llmNeedParserUnavailable === true);

  useEffect(() => {
    setSearchParams((current) => {
      const next = mergeFiltersToSearchParams(current, filters);
      if (llmNeedParserUnavailable) {
        next.set("llm", "unavailable");
      }
      return next;
    }, { replace: true });
  }, [filters, llmNeedParserUnavailable, setSearchParams]);

  useEffect(() => {
    const query = filters.query.trim();
    if (!query || filters.need.trim() || agentEntries.length === 0 || filtered.length > 0) return;
    if (lastSemanticQueryRef.current === query) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (lastSemanticQueryRef.current === query) return;
      lastSemanticQueryRef.current = query;
      void parseNeedWithLlm({ query, locale, taxonomy }).then((parsed) => {
        if (cancelled) return;
        if (parsed.ok) {
          setSemanticParseError("");
          setFilters(toFiltersFromNeedParse(parsed.result, query));
          return;
        }
        setSemanticParseError(parsed.error);
      });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [agentEntries.length, filtered.length, filters.need, filters.query, locale, taxonomy]);

  const handleChange = useCallback((next: CatalogFilters) => {
    setFilters(next);
  }, []);

  const handleScenarioSuggestion = useCallback((scenarioId: string) => {
    setFilters({ ...EMPTY_FILTERS, scenarios: [scenarioId] });
  }, []);

  const isLoadingCatalog = nativeStatus === "loading" && entries.length === 0;

  return (
    <section className="container-page min-w-0 py-8 sm:py-12">
      <PageHeading title={t("title")} description={t("subtitle")} className="max-w-3xl" />
      <div className="mt-7 flex min-w-0 flex-col gap-6 sm:mt-9 sm:gap-8">
        {llmNeedParserUnavailable ? (
          <Card>
            <CardContent className="px-6 py-4 text-sm text-muted-foreground">
              {t("results.llmUnavailable")}
            </CardContent>
          </Card>
        ) : null}
        {semanticParseError ? (
          <Card>
            <CardContent className="px-6 py-4 text-sm text-destructive">
              {t("results.llmUnavailable")}
            </CardContent>
          </Card>
        ) : null}
        <SearchFilterBar filters={filters} facets={facets} onChange={handleChange} resultCount={filtered.length} />
        {isLoadingCatalog ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-44" />
            ))}
          </div>
        ) : (
          <AgentList
            entries={filtered}
            emptyState={
              <Card>
                <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
                  <p className="text-base font-medium">{t("results.empty")}</p>
                  <p className="max-w-md text-sm text-muted-foreground">{t("results.emptyHint")}</p>
                  {emptyScenarioSuggestions.length > 0 ? (
                    <div className="flex max-w-md flex-col items-center gap-3">
                      <p className="text-sm text-muted-foreground">{t("results.emptyScenarioHint")}</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {emptyScenarioSuggestions.map((scenarioId) => (
                          <Button
                            key={scenarioId}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleScenarioSuggestion(scenarioId)}
                          >
                            {pickText(SCENARIO_MAP[scenarioId], locale)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {!filtersAreEmpty(filters) && relaxationSuggestion ? (
                    <p className="max-w-md text-sm text-foreground">
                      {t("results.relaxHint", {
                        filter: describeRelaxationChip(relaxationSuggestion.chip),
                        count: relaxationSuggestion.resultCount
                      })}
                    </p>
                  ) : null}
                  {!filtersAreEmpty(filters) ? (
                    <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                      {t("filters.clear")}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            }
          />
        )}
      </div>
    </section>
  );
}

function describeRelaxationChip(chip: FilterChip): string {
  switch (chip.kind) {
    case "query":
      return `"${String(chip.value)}"`;
    case "need":
      return `need:${String(chip.value)}`;
    case "scenario":
      return `scenario:${String(chip.value)}`;
    case "tag":
      return `tag:${String(chip.value)}`;
    case "category":
      return `category:${String(chip.value)}`;
    case "productType":
      return `type:${String(chip.value)}`;
    case "source":
      return `source:${String(chip.value)}`;
    case "access":
      return `access:${String(chip.value)}`;
    case "trustTier":
      return `tier:${String(chip.value)}`;
    case "risk":
      return `risk:${String(chip.value)}`;
    case "complexity":
      return `complexity:${String(chip.value)}`;
    case "price":
      return `price:${String(chip.value)}`;
    case "auditStatus":
      return `auditStatus:${String(chip.value)}`;
    case "score":
      return `score:${String(chip.value)}`;
    case "hasOnboarding":
      return "onboarding";
    case "hasAudit":
      return "audit";
    case "rentable":
      return "rentable";
    case "sort":
      return `sort:${String(chip.value)}`;
  }
}
