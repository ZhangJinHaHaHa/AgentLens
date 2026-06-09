import { ArrowUpRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AgentTypeChip } from "@/components/agent/AgentTypeChip";
import { TrustTierBadge } from "@/components/trust/TrustTierBadge";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/useLocale";
import { useCompareSelection } from "@/hooks/useCompareSelection";
import { cn } from "@/lib/utils";
import type { AgentCatalogEntry, RiskLevel } from "@/domain/catalog";
import { isNativeEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";
import { computeTrustTier } from "@/domain/trustTier";

interface AgentDetailHeaderProps {
  entry: AgentCatalogEntry;
}

const RISK_PILL: Record<RiskLevel, string> = {
  low: "border-success/40 bg-success/10 text-success-foreground/80",
  medium: "border-warning/40 bg-warning/10 text-warning-foreground/80",
  high: "border-danger/40 bg-danger/10 text-danger-foreground/80"
};

export function AgentDetailHeader({ entry }: AgentDetailHeaderProps): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("detail");
  const { t: tc } = useTranslation("common");
  const { ids, addId, removeId } = useCompareSelection();
  const isCompared = ids.includes(entry.id);
  const tier = computeTrustTier({ entry });
  const native = isNativeEntry(entry);

  return (
    <header className="glass-nav sticky top-14 z-30 -mx-6 border-b px-6 sm:-mx-8 sm:px-8">
      <div className="container-page flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <AgentTypeChip source={entry.source} />
            <TrustTierBadge result={tier} variant="compact" />
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                RISK_PILL[entry.riskLevel]
              )}
            >
              {tc(`risk.${entry.riskLevel}`)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">{entry.name}</h1>
            {(entry.vendor || entry.category) && (
              <p className="text-xs text-muted-foreground">
                {[entry.vendor, entry.category].filter(Boolean).join(" · ")}
              </p>
            )}
            {entry.tagline ? (
              <p className="text-sm text-muted-foreground">{pickText(entry.tagline, locale)}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={isCompared ? "outline" : "secondary"}
            onClick={(e) => { e.preventDefault(); isCompared ? removeId(entry.id) : addId(entry.id); }}
            disabled={!isCompared && ids.length >= 4}
          >
            <Plus className={cn("h-3.5 w-3.5", isCompared && "rotate-45")} aria-hidden />
            {isCompared ? t("header.addedToCompare") : t("header.addToCompare")}
          </Button>
          {entry.officialUrl ? (
            <Button size="sm" asChild>
              <a href={entry.officialUrl} target="_blank" rel="noreferrer">
                {t("header.viewOfficial")}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
          ) : null}
          {native ? (
            <Button size="sm" variant="outline" disabled aria-disabled title="Phase 3">
              {t("header.requestAudit")}
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
