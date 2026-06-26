import { ArrowUpRight, Check, Download, PlayCircle, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

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
  onInstallClick?: () => void;
  primaryAction?: "install" | "use";
}

const RISK_PILL: Record<RiskLevel, string> = {
  low: "border-success/40 bg-success/10 text-success-foreground/80",
  medium: "border-warning/40 bg-warning/10 text-warning-foreground/80",
  high: "border-danger/40 bg-danger/10 text-danger-foreground/80"
};

export function AgentDetailHeader({ entry, onInstallClick, primaryAction = "install" }: AgentDetailHeaderProps): JSX.Element {
  const { buildPath, locale } = useLocale();
  const { t } = useTranslation("detail");
  const { t: tc } = useTranslation("common");
  const { ids, addId, removeId } = useCompareSelection();
  const isCompared = ids.includes(entry.id);
  const tier = computeTrustTier({ entry });
  const native = isNativeEntry(entry);

  return (
    <header className="glass-nav sticky top-14 z-30 border-b">
      <div className="container-page flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <AgentTypeChip entry={entry} />
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
            type="button"
            size="sm"
            variant="secondary"
            onClick={onInstallClick}
          >
            {primaryAction === "use" ? (
              <PlayCircle className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden />
            )}
            {t(primaryAction === "use" ? "header.useAgent" : "header.installAgent")}
          </Button>
          <Button
            size="sm"
            variant={isCompared ? "outline" : "secondary"}
            onClick={(e) => { e.preventDefault(); isCompared ? removeId(entry.id) : addId(entry.id); }}
            disabled={!isCompared && ids.length >= 4}
          >
            {isCompared ? (
              <Check className="h-3.5 w-3.5 text-success" aria-hidden />
            ) : (
              <Plus className="h-3.5 w-3.5" aria-hidden />
            )}
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
            <Button size="sm" variant="outline" asChild>
              <Link to={buildAuditPublishPath(entry, buildPath, locale)}>
                {t("header.requestAudit")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function buildAuditPublishPath(
  entry: AgentCatalogEntry,
  buildPath: (path: string) => string,
  locale: "zh" | "en"
): string {
  const params = new URLSearchParams();
  params.set("mode", "native-image");
  params.set("agentName", entry.name);
  params.set("displayName", entry.name);
  params.set("summary", pickText(entry.intro, locale));
  if (entry.recommendedFor.length > 0) {
    params.set("useCases", entry.recommendedFor.map((item) => pickText(item, locale)).join("\n"));
  }
  const capabilities = [
    ...entry.accessTypes,
    ...entry.tags.slice(0, 6)
  ].filter(Boolean);
  if (capabilities.length > 0) {
    params.set("capabilities", capabilities.join("\n"));
  }
  if (entry.riskNotes.length > 0) {
    params.set("limitations", entry.riskNotes.map((item) => pickText(item, locale)).join("\n"));
  }
  if (entry.docsUrl) {
    params.set("docsUrl", entry.docsUrl);
  }
  if (entry.officialUrl) {
    params.set("supportUrl", entry.officialUrl);
  }
  return `${buildPath("/publish")}?${params.toString()}`;
}
