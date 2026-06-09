import { ExternalLink, HelpCircle, Lock, PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocale } from "@/i18n/useLocale";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { isNativeEntry } from "@/domain/catalog";
import {
  getPlatformAuditReadiness,
  PLATFORM_AUDIT_DIMENSIONS,
  type PlatformAuditDimension
} from "@/domain/platformAudit";
import { computeTrustTier } from "@/domain/trustTier";
import { isAttestationPresent } from "@/lib/chainEvidence";

import { TrustTierExplain } from "./TrustTierExplain";

interface TrustEvidenceCardProps {
  entry: AgentCatalogEntry;
}

export function TrustEvidenceCard({ entry }: TrustEvidenceCardProps): JSX.Element {
  const { buildPath } = useLocale();
  const { t } = useTranslation("detail");
  const tier = computeTrustTier({ entry });
  const native = isNativeEntry(entry);
  const audit = entry.chainEvidence;
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

        <Separator />
        <PlatformSandboxAuditPanel readiness={platformAudit} />

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
  readiness
}: {
  readiness: ReturnType<typeof getPlatformAuditReadiness>;
}): JSX.Element {
  const { t } = useTranslation("detail");
  const locked = readiness.status === "lockedWithoutImage";

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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORM_AUDIT_DIMENSIONS.map((dimension) => (
          <AuditDimensionSlot
            key={dimension}
            dimension={dimension}
            locked={locked}
          />
        ))}
      </div>

      {locked ? (
        <LockedAuditExplanation />
      ) : (
        <OwnerAuditEntry llmProvider={readiness.llmProvider} />
      )}
    </div>
  );
}

function AuditDimensionSlot({
  dimension,
  locked
}: {
  dimension: PlatformAuditDimension;
  locked: boolean;
}): JSX.Element {
  const { t } = useTranslation("detail");

  return (
    <div className="flex min-h-20 items-start justify-between gap-3 rounded-md border border-dashed border-border bg-muted/20 p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{t(`nativeChain.dimensions.${dimension}`)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {locked ? t("trust.platformAudit.dimensionLocked") : t("trust.platformAudit.dimensionPending")}
        </p>
      </div>
      {locked ? (
        <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
      ) : (
        <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-warning" aria-hidden />
      )}
    </div>
  );
}

function OwnerAuditEntry({ llmProvider }: { llmProvider: string }): JSX.Element {
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
        </div>
        <Button type="button" size="sm" disabled>
          <PlayCircle className="h-4 w-4" aria-hidden />
          {t("trust.platformAudit.ownerAction")}
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
