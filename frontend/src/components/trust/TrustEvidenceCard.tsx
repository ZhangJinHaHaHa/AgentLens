import { ExternalLink, HelpCircle, Lock, PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AuditDimensionRadar, type AuditDimensionRadarItem } from "@/components/trust/AuditDimensionRadar";
import { useLocale } from "@/i18n/useLocale";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { isNativeEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";
import {
  getPlatformAuditReadiness,
  PLATFORM_AUDIT_DIMENSIONS
} from "@/domain/platformAudit";
import { computeTrustTier } from "@/domain/trustTier";
import { isAttestationPresent } from "@/lib/chainEvidence";

import { TrustTierExplain } from "./TrustTierExplain";

interface TrustEvidenceCardProps {
  entry: AgentCatalogEntry;
}

export function TrustEvidenceCard({ entry }: TrustEvidenceCardProps): JSX.Element {
  const { buildPath, locale } = useLocale();
  const { t } = useTranslation("detail");
  const tier = computeTrustTier({ entry });
  const native = isNativeEntry(entry);
  const audit = entry.chainEvidence;
  const hasChainAuditEvidence = Boolean(
    audit?.auditPassed ||
      audit?.reportHash ||
      isAttestationPresent(audit?.attestationHash) ||
      (typeof audit?.auditCount === "number" && audit.auditCount > 0)
  );
  const platformAudit = getPlatformAuditReadiness(entry);
  const auditReportIndex =
    typeof audit?.auditCount === "number" && audit.auditCount > 0 ? audit.auditCount - 1 : 0;
  const auditReportPath =
    audit?.tokenId && (audit.auditCount === undefined || audit.auditCount > 0)
      ? buildPath(`/agent/${audit.tokenId}/audits/latest/${auditReportIndex}`)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("trust.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <TrustTierExplain result={tier} className="border-0 shadow-none" />

        {hasChainAuditEvidence ? null : (
          <>
            <Separator />
            <PlatformSandboxAuditPanel
              entry={entry}
              locale={locale}
              publishPath={buildAuditPublishPath(entry, buildPath, locale)}
              readiness={platformAudit}
            />
          </>
        )}

        {native && audit ? (
          <>
            <Separator />
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("trust.audit")}
              </p>
              <ul className="flex flex-col gap-1.5 text-xs font-mono text-foreground/80">
                {audit.reportHash ? (
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground">report:</span>
                    <span className="break-all">{audit.reportHash}</span>
                  </li>
                ) : null}
                {isAttestationPresent(audit.attestationHash) ? (
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground">attestation:</span>
                    <span className="break-all">{audit.attestationHash}</span>
                  </li>
                ) : null}
                {audit.tokenId ? (
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground">tokenId:</span>
                    <span>{audit.tokenId}</span>
                  </li>
                ) : null}
              </ul>
              {auditReportPath ? (
                <div>
                  <Button asChild size="sm" variant="secondary">
                    <Link to={auditReportPath}>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      {t("header.viewAudit")}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("trust.noChainEvidence")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function PlatformSandboxAuditPanel({
  entry,
  locale,
  publishPath,
  readiness
}: {
  entry: AgentCatalogEntry;
  locale: "zh" | "en";
  publishPath: string;
  readiness: ReturnType<typeof getPlatformAuditReadiness>;
}): JSX.Element {
  const { t } = useTranslation("detail");
  const locked = readiness.status === "lockedWithoutImage";
  const radarItems: AuditDimensionRadarItem[] = PLATFORM_AUDIT_DIMENSIONS.map((dimension) => ({
    key: dimension,
    label: t(`nativeChain.dimensions.${dimension}`),
    value: 0
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("trust.platformAudit.title")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("trust.platformAudit.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={readiness.canRunSandboxAudit ? "success" : "secondary"}>
            {t(`trust.platformAudit.runtime.${readiness.runtimeKind}`)}
          </Badge>
          <Badge variant={locked ? "warning" : "outline"}>
            {t(`trust.platformAudit.status.${readiness.status}`)}
          </Badge>
        </div>
      </div>

      <div className="relative">
        <AuditDimensionRadar
          className="opacity-35"
          items={radarItems}
        />
        <div className="absolute inset-0 flex items-center justify-center rounded-md border border-dashed border-border bg-background/75 p-4 text-center backdrop-blur-sm">
          <div className="max-w-md">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border bg-background">
              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              {locked
                ? t("trust.platformAudit.lockedTitle")
                : t("trust.platformAudit.pendingTitle")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {locked
                ? t("trust.platformAudit.lockedDescription")
                : t("trust.platformAudit.pendingDescription")}
            </p>
          </div>
        </div>
      </div>

      {locked ? (
        <LockedAuditExplanation />
      ) : (
        <OwnerAuditEntry
          agentName={entry.name}
          llmProvider={readiness.llmProvider}
          publishPath={publishPath}
          summary={pickText(entry.intro, locale)}
        />
      )}
    </div>
  );
}

function OwnerAuditEntry({
  agentName,
  llmProvider,
  publishPath,
  summary
}: {
  agentName: string;
  llmProvider: string;
  publishPath: string;
  summary: string;
}): JSX.Element {
  const { t } = useTranslation("detail");

  return (
    <div className="rounded-md border border-border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("trust.platformAudit.ownerTitle")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("trust.platformAudit.ownerDescription", { provider: llmProvider })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("trust.platformAudit.ownerPrefill", { agent: agentName, summary })}
          </p>
        </div>
        <Button asChild size="sm">
          <Link to={publishPath}>
            <PlayCircle className="h-4 w-4" aria-hidden />
            {t("trust.platformAudit.ownerAction")}
          </Link>
        </Button>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <span>{t("trust.platformAudit.ownerStepManifest")}</span>
        <span>{t("trust.platformAudit.ownerStepSandbox", { provider: llmProvider })}</span>
        <span>{t("trust.platformAudit.ownerStepReport")}</span>
      </div>
    </div>
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

function LockedAuditExplanation(): JSX.Element {
  const { t } = useTranslation("detail");

  return (
    <div className="rounded-md border border-border bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">
              {t("trust.platformAudit.lockedTitle")}
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                  aria-label={t("trust.platformAudit.lockedHelpLabel")}
                >
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t("trust.platformAudit.lockedHelp")}
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("trust.platformAudit.lockedDescription")}
          </p>
        </div>
      </div>
    </div>
  );
}
