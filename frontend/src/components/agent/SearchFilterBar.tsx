import { useId, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/useLocale";
import type {
  AccessType
} from "@/domain/catalog";
import {
  EMPTY_FILTERS,
  getActiveFilterChips,
  removeFilterChip,
  filtersAreEmpty,
  type CatalogFacets,
  type CatalogFilters,
  type FilterChip,
  type AuditStatusFilter,
  type PriceMode,
  type ScoreBand,
  type SortKey
} from "@/domain/filters";
import { SCENARIO_IDS, SCENARIO_MAP } from "@/data/catalog/scenarios";
import { pickText } from "@/domain/i18nText";

interface SearchFilterBarProps {
  filters: CatalogFilters;
  facets: CatalogFacets;
  onChange: (next: CatalogFilters) => void;
  resultCount: number;
  className?: string;
}

const SORT_OPTIONS: SortKey[] = ["default", "newest", "trust", "risk", "complexity"];

export function SearchFilterBar({
  filters,
  facets,
  onChange,
  resultCount,
  className
}: SearchFilterBarProps): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("agents");
  const { t: tc } = useTranslation("common");
  const { t: tt } = useTranslation("tiers");
  const filterPanelId = useId();
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const priceModeFacets = facets.priceModes ?? [];
  const auditStatusFacets = facets.auditStatuses ?? [];
  const scoreBandFacets = facets.scoreBands ?? [];

  function patch(next: Partial<CatalogFilters>): void {
    onChange({ ...filters, ...next });
  }

  function toggleArray<T extends string | number>(
    key: keyof Pick<
      CatalogFilters,
      | "scenarios"
      | "tags"
      | "categories"
      | "sources"
      | "accessTypes"
      | "trustTiers"
      | "riskLevels"
      | "complexities"
      | "priceModes"
      | "auditStatuses"
      | "scoreBands"
    >,
    value: T
  ): void {
    const current = filters[key] as T[];
    const exists = current.includes(value);
    const next = exists ? current.filter((v) => v !== value) : [...current, value];
    onChange({ ...filters, [key]: next } as CatalogFilters);
  }

  function describeChip(chip: FilterChip): string {
    switch (chip.kind) {
      case "query":
        return `${t("filters.chips.query")}: ${String(chip.value)}`;
      case "need":
        return `${t("filters.chips.need")}: ${String(chip.value)}`;
      case "scenario":
        return pickText(SCENARIO_MAP[String(chip.value)], locale);
      case "tag":
        return `${t("filters.chips.tag")}: ${String(chip.value)}`;
      case "category":
        return `${t("filters.category")}: ${String(chip.value)}`;
      case "source":
        return tc(`agentSource.${String(chip.value)}`);
      case "access":
        return tc(`access.${String(chip.value)}`);
      case "trustTier":
        return tt(`labels.tier${String(chip.value)}`);
      case "risk":
        return tc(`risk.${String(chip.value)}`);
      case "complexity":
        return tc(`complexity.${String(chip.value)}`);
      case "price":
        return t(`filters.priceModes.${String(chip.value)}`);
      case "auditStatus":
        return t(`filters.auditStatuses.${String(chip.value)}`);
      case "score":
        return t(`filters.scoreBands.${String(chip.value)}`);
      case "hasOnboarding":
        return t("filters.onboarding");
      case "hasAudit":
        return t("filters.audit");
      case "rentable":
        return t("filters.rentable");
      case "sort":
        return `${t("sort.label")}: ${t(`sort.${String(chip.value)}`)}`;
    }
  }

  const activeChips = getActiveFilterChips(filters);

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={filters.query}
            onChange={(event) => patch({ query: event.target.value })}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
            aria-label={tc("actions.search")}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t("results.count", { count: resultCount })}
          </span>
          <Select value={filters.sort} onValueChange={(value) => patch({ sort: value as SortKey })}>
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue placeholder={t("sort.label")} />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`sort.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("filters.active")}
          </span>
          {activeChips.map((chip) => (
            <Badge key={chip.id} variant="outline" className="gap-1.5 py-1">
              <span>{describeChip(chip)}</span>
              <button
                type="button"
                className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("filters.removeChip", { label: describeChip(chip) })}
                onClick={() => onChange(removeFilterChip(filters, chip))}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 py-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            <button
              type="button"
              className="-m-2 inline-flex items-center gap-2 rounded-md p-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={isFilterPanelOpen}
              aria-controls={filterPanelId}
              onClick={() => setIsFilterPanelOpen((current) => !current)}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              <span>{t("filters.title")}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  isFilterPanelOpen ? "rotate-180" : "rotate-0"
                )}
                aria-hidden
              />
            </button>
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={filtersAreEmpty(filters)}
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            {t("filters.clear")}
          </Button>
        </CardHeader>
        {isFilterPanelOpen ? (
          <>
            <Separator />
            <CardContent id={filterPanelId} className="grid gap-6 px-6 py-6 md:grid-cols-2 lg:grid-cols-3">
              {facets.scenarioIds.length > 0 ? (
                <FilterGroup label={t("filters.scenario")}>
                  {facets.scenarioIds.map((id) => (
                    <Checkbox
                      key={id}
                      checked={filters.scenarios.includes(id)}
                      onChange={() => toggleArray("scenarios", id)}
                      label={pickText(SCENARIO_MAP[id], locale)}
                    />
                  ))}
                </FilterGroup>
              ) : null}

              {/*
               * Tag and category facets intentionally hidden: they render raw
               * internal labels ("ide", "on-chain", "AI IDE") that read as
               * jargon to lay buyers. Scenario (plain-language) is the primary
               * "what it does" axis. Filtering by tag/category still works via
               * URL params and active chips — only the checkbox UI is removed.
               */}

              {facets.sources.length > 0 ? (
                <FilterGroup label={t("filters.type")}>
                  {facets.sources.map((source) => (
                    <Checkbox
                      key={source}
                      checked={filters.sources.includes(source)}
                      onChange={() => toggleArray("sources", source)}
                      label={tc(`agentSource.${source}`)}
                    />
                  ))}
                </FilterGroup>
              ) : null}

              {facets.accessTypes.length > 0 ? (
                <FilterGroup label={t("filters.access")}>
                  {facets.accessTypes.map((option: AccessType) => (
                    <Checkbox
                      key={option}
                      checked={filters.accessTypes.includes(option)}
                      onChange={() => toggleArray("accessTypes", option)}
                      label={tc(`access.${option}`)}
                    />
                  ))}
                </FilterGroup>
              ) : null}

              {facets.trustTiers.length > 0 ? (
                <FilterGroup label={t("filters.trustTier")}>
                  {facets.trustTiers.map((tier) => (
                    <Checkbox
                      key={tier}
                      checked={filters.trustTiers.includes(tier)}
                      onChange={() => toggleArray("trustTiers", tier)}
                      label={tt(`labels.tier${tier}`)}
                    />
                  ))}
                </FilterGroup>
              ) : null}

              {facets.riskLevels.length > 0 ? (
                <FilterGroup label={t("filters.risk")}>
                  {facets.riskLevels.map((option) => (
                    <Checkbox
                      key={option}
                      checked={filters.riskLevels.includes(option)}
                      onChange={() => toggleArray("riskLevels", option)}
                      label={tc(`risk.${option}`)}
                    />
                  ))}
                </FilterGroup>
              ) : null}

              {facets.complexities.length > 0 ? (
                <FilterGroup label={t("filters.complexity")}>
                  {facets.complexities.map((option) => (
                    <Checkbox
                      key={option}
                      checked={filters.complexities.includes(option)}
                      onChange={() => toggleArray("complexities", option)}
                      label={tc(`complexity.${option}`)}
                    />
                  ))}
                </FilterGroup>
              ) : null}

              {priceModeFacets.length > 0 ? (
                <FilterGroup label={t("filters.price")}>
                  {priceModeFacets.map((option: PriceMode) => (
                    <Checkbox
                      key={option}
                      checked={filters.priceModes.includes(option)}
                      onChange={() => toggleArray("priceModes", option)}
                      label={t(`filters.priceModes.${option}`)}
                    />
                  ))}
                </FilterGroup>
              ) : null}

              {auditStatusFacets.length > 0 ? (
                <FilterGroup label={t("filters.auditStatus")}>
                  {auditStatusFacets.map((option: AuditStatusFilter) => (
                    <Checkbox
                      key={option}
                      checked={filters.auditStatuses.includes(option)}
                      onChange={() => toggleArray("auditStatuses", option)}
                      label={t(`filters.auditStatuses.${option}`)}
                    />
                  ))}
                </FilterGroup>
              ) : null}

              {scoreBandFacets.length > 0 ? (
                <FilterGroup label={t("filters.scoreBand")}>
                  {scoreBandFacets.map((option: ScoreBand) => (
                    <Checkbox
                      key={option}
                      checked={filters.scoreBands.includes(option)}
                      onChange={() => toggleArray("scoreBands", option)}
                      label={t(`filters.scoreBands.${option}`)}
                    />
                  ))}
                </FilterGroup>
              ) : null}

              {facets.toggles.hasOnboarding || facets.toggles.hasAudit || facets.toggles.rentable ? (
                <FilterGroup label={tc("agentSource.native")} className="md:col-span-2 lg:col-span-3">
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {facets.toggles.hasOnboarding ? (
                      <Checkbox
                        checked={filters.hasOnboarding}
                        onChange={(event) => patch({ hasOnboarding: event.target.checked })}
                        label={t("filters.onboarding")}
                      />
                    ) : null}
                    {facets.toggles.hasAudit ? (
                      <Checkbox
                        checked={filters.hasAudit}
                        onChange={(event) => patch({ hasAudit: event.target.checked })}
                        label={t("filters.audit")}
                      />
                    ) : null}
                    {facets.toggles.rentable ? (
                      <Checkbox
                        checked={filters.rentable}
                        onChange={(event) => patch({ rentable: event.target.checked })}
                        label={t("filters.rentable")}
                      />
                    ) : null}
                  </div>
                </FilterGroup>
              ) : null}
            </CardContent>
          </>
        ) : null}
      </Card>
    </div>
  );
}

interface FilterGroupProps {
  label: string;
  className?: string;
  children: React.ReactNode;
}

function FilterGroup({ label, className, children }: FilterGroupProps): JSX.Element {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
