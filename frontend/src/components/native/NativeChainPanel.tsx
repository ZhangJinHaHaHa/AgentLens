import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BadgeCheck, History } from "lucide-react";

import marketplaceArtifact from "../../../../contracts/artifacts/AgentMarketplace.json";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditDimensionRadar, type AuditDimensionRadarItem } from "@/components/trust/AuditDimensionRadar";
import type { AppConfig } from "@/config/appConfig";
import { useLocale } from "@/i18n/useLocale";
import {
  createAgentAuditRegistryClient,
  createAgentAuditRegistryV3Client,
  type AgentAuditRegistryReadContract,
  type AgentAuditRegistryV2Client,
  type AuditRecord,
  type DimensionalScoresOnChain
} from "@/lib/agentAuditRegistryClient";
import { getAuditStatusLabel } from "@/lib/auditStatus";
import { isAttestationPresent } from "@/lib/chainEvidence";
import { formatBondWei, formatPriceEth, formatTimestamp, truncateAddress } from "@/lib/format";
import { createMarketplaceClient, type MarketplaceClient } from "@/lib/marketplaceClient";
import { parseTokenIdInput } from "@/lib/tokenId";
import { cn } from "@/lib/utils";
import { useAccessHistory } from "@/hooks/useAccessHistory";
import { useAgentCredit } from "@/hooks/useAgentCredit";
import { useAgentPricing } from "@/hooks/useAgentPricing";
import { normalizeBasisPointScore, useAgentRiskProfile } from "@/hooks/useAgentRiskProfile";
import { useAuditHistory } from "@/hooks/useAuditHistory";
import { NativeMarketplaceActions } from "./NativeMarketplaceActions";

interface NativeChainPanelProps {
  config: AppConfig;
  tokenId: string;
}

const SCORE_DIMENSIONS: Array<{
  key: keyof DimensionalScoresOnChain;
}> = [
  { key: "security" },
  { key: "taskExecution" },
  { key: "cognitive" },
  { key: "environment" },
  { key: "engineering" },
  { key: "compliance" }
];

function statusTone(status: bigint | number): "default" | "secondary" | "danger" | "outline" {
  const label = getAuditStatusLabel(status).toLowerCase();
  if (label === "passed" || label === "compensated") return "default";
  if (label === "pending") return "secondary";
  if (label === "failed" || label === "slashed") return "danger";
  return "outline";
}

export function NativeChainPanel({ config, tokenId }: NativeChainPanelProps): JSX.Element {
  const { t } = useTranslation("detail");
  const parsed = parseTokenIdInput(tokenId);

  if (!parsed.ok) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          {t("nativeChain.invalidToken")}
        </CardContent>
      </Card>
    );
  }

  return <NativeChainPanelInner config={config} tokenId={parsed.value} tokenIdLabel={parsed.normalized} />;
}

function NativeChainPanelInner({
  config,
  tokenId,
  tokenIdLabel
}: {
  config: AppConfig;
  tokenId: bigint;
  tokenIdLabel: string;
}): JSX.Element {
  const { t } = useTranslation("detail");
  const { buildPath } = useLocale();
  const [client] = useState<AgentAuditRegistryReadContract>(() => createAgentAuditRegistryClient(config));
  const [v2Client] = useState<AgentAuditRegistryV2Client>(() =>
    createAgentAuditRegistryV3Client(config.registryAddress, config.rpcUrl, config.chainId)
  );
  const [marketplaceClient] = useState<MarketplaceClient | null>(() => {
    if (!config.marketplaceAddress) return null;
    return createMarketplaceClient(
      config.marketplaceAddress,
      marketplaceArtifact.abi,
      config.rpcUrl,
      config.chainId
    );
  });

  const credit = useAgentCredit({ tokenId, client, v2Client });
  const latestAuditAttested = isAttestationPresent(credit.latestAudit?.attestationHash);
  const risk = useAgentRiskProfile({
    tokenId,
    v2Client,
    reputationScore: credit.reputation?.currentReputationScore ?? 5000,
    auditCount: credit.profile ? Number(credit.profile.auditCount) : 0,
    attestationVerified: latestAuditAttested
  });
  const pricing = useAgentPricing({ tokenId, marketplaceClient });
  const auditHistory = useAuditHistory({ tokenId, client });
  const accessHistory = useAccessHistory({
    tokenId: tokenIdLabel,
    marketplaceClient: marketplaceClient ?? undefined
  });

  if (credit.status === "loading") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (credit.status === "error" || !credit.profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("nativeChain.profileTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {credit.errorMessage ?? t("nativeChain.profileLoadError")}
        </CardContent>
      </Card>
    );
  }

  const profile = credit.profile;
  const latestAudit = credit.latestAudit;
  const reputation = credit.reputation;
  const rentalRecords = accessHistory.records.filter((record) => record.isRental);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("nativeChain.profileTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Meta label={t("nativeChain.meta.token")} value={`#${tokenIdLabel}`} />
              <Meta label={t("nativeChain.meta.developer")} value={truncateAddress(profile.developer)} mono title={profile.developer} />
              <Meta label={t("nativeChain.meta.bond")} value={formatBondWei(profile.totalBond)} />
              <Meta label={t("nativeChain.meta.audits")} value={String(Number(profile.auditCount))} />
              <Meta label={t("nativeChain.meta.created")} value={formatTimestamp(profile.createdAt)} />
              <Meta label={t("nativeChain.meta.lastAudit")} value={formatTimestamp(profile.lastAuditAt)} />
              <Meta
                label={t("nativeChain.meta.zkVerifier")}
                value={config.zkVerifierAddress ? truncateAddress(config.zkVerifierAddress) : t("nativeChain.notConfigured")}
                mono={Boolean(config.zkVerifierAddress)}
                title={config.zkVerifierAddress}
              />
            </dl>
            {profile.blacklisted ? (
              <Badge variant="danger" className="mt-4">
                {t("nativeChain.blacklisted")}
              </Badge>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("nativeChain.reputationTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {reputation ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label={t("nativeChain.meta.score")} value={String(reputation.currentReputationScore)} />
                <Metric label={t("nativeChain.meta.appealsWon")} value={String(reputation.successfulAppeals)} />
                <Metric label={t("nativeChain.meta.appealsLost")} value={String(reputation.failedAppeals)} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("nativeChain.noReputation")}</p>
            )}
            <Separator />
            {pricing.status === "ready" && pricing.pricing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric
                  label={t("nativeChain.meta.rentPerDay")}
                  value={pricing.pricing.configured ? formatPriceEth(pricing.pricing.pricePerDay) : t("nativeChain.notSet")}
                />
                <Metric label={t("nativeChain.meta.accesses")} value={String(pricing.accessCount ?? 0)} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("nativeChain.marketplaceUnavailable")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <NativeMarketplaceActions
        config={config}
        tokenId={tokenId}
        marketplaceClient={marketplaceClient}
        pricing={pricing.pricing}
      />

      {risk.status === "ready" && (risk.averageScores || risk.riskProfile) ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("nativeChain.capabilityTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {risk.averageScores ? <ScoreRadar scores={risk.averageScores} /> : null}
            {risk.riskProfile && risk.riskProfile.scenarios.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {risk.riskProfile.scenarios.map((scenario) => (
                  <div key={scenario.scenario} className="rounded-md border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{scenario.scenario}</p>
                      <Badge
                        variant={
                          scenario.suitability === "recommended"
                            ? "default"
                            : scenario.suitability === "acceptable"
                              ? "secondary"
                              : "danger"
                        }
                      >
                        {t(`nativeChain.suitability.${scenario.suitability}`)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{scenario.reasoning}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4" aria-hidden />
              {t("nativeChain.latestAudit")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestAudit ? (
              <LatestAudit tokenId={tokenIdLabel} audit={latestAudit} auditIndex={Math.max(Number(profile.auditCount) - 1, 0)} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("nativeChain.noAudit")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" aria-hidden />
              {t("nativeChain.auditHistory")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditHistory.status === "loading" ? (
              <Skeleton className="h-32" />
            ) : auditHistory.status === "error" ? (
              <p className="text-sm text-muted-foreground">
                {auditHistory.errorMessage ?? "Unable to load audit history."}
              </p>
            ) : auditHistory.status === "ready" && auditHistory.records.length > 0 ? (
              <div className="flex flex-col gap-3">
                {auditHistory.records.map((audit, idx) => {
                  const auditIndex = auditHistory.totalCount - 1 - idx;
                  return (
                    <AuditHistoryRow
                      key={`${String(audit.auditId)}-${auditIndex}`}
                      tokenId={tokenIdLabel}
                      audit={audit}
                      auditIndex={auditIndex}
                      buildPath={buildPath}
                    />
                  );
                })}
                {auditHistory.hasMore ? (
                  <Button variant="secondary" size="sm" onClick={() => void auditHistory.loadMore()}>
                    {auditHistory.isLoadingMore ? t("nativeChain.loading") : t("nativeChain.loadMoreAudits")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("nativeChain.noAuditHistory")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {accessHistory.status === "ready" && rentalRecords.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("nativeChain.recentRentals")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {rentalRecords.map((record, idx) => (
              <div key={`${record.expiresAt}-${record.amountPaid.toString()}-${idx}`} className="rounded-md border border-border p-4 text-sm">
                <p className="font-mono text-xs text-muted-foreground">
                  {t("nativeChain.anonymousRental", { index: idx + 1 })}
                </p>
                <p className="mt-1">{t("nativeChain.rental")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("nativeChain.paid", { amount: formatPriceEth(record.amountPaid) })}
                  {record.expiresAt > 0 ? ` · ${t("nativeChain.expires", { time: formatTimestamp(record.expiresAt) })}` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function LatestAudit({
  tokenId,
  audit,
  auditIndex
}: {
  tokenId: string;
  audit: AuditRecord;
  auditIndex: number;
}): JSX.Element {
  const { t } = useTranslation("detail");
  const { buildPath } = useLocale();
  const status = getLocalizedAuditStatus(audit.status, t);
  const attestationValue = isAttestationPresent(audit.attestationHash)
    ? (audit.attestationHash as string)
    : "—";

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusTone(audit.status)}>{status}</Badge>
        <span className="text-muted-foreground">{t("nativeChain.score")} {String(Number(audit.auditScore))}</span>
        <span className="text-muted-foreground">{formatTimestamp(audit.timestamp)}</span>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Meta label={t("nativeChain.meta.reportCid")} value={audit.reportCID || "—"} mono />
        <Meta label={t("nativeChain.meta.attestation")} value={attestationValue} mono />
      </dl>
      <Button asChild size="sm" variant="secondary" className="w-fit">
        <Link to={buildPath(`/agent/${tokenId}/audits/${String(audit.auditId)}/${auditIndex}`)}>
          {t("nativeChain.viewReport")}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

function AuditHistoryRow({
  tokenId,
  audit,
  auditIndex,
  buildPath
}: {
  tokenId: string;
  audit: AuditRecord;
  auditIndex: number;
  buildPath: (path: string) => string;
}): JSX.Element {
  const { t } = useTranslation("detail");
  return (
    <Link
      to={buildPath(`/agent/${tokenId}/audits/${String(audit.auditId)}/${auditIndex}`)}
      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm hover:border-foreground/40"
    >
      <div className="flex items-center gap-2">
        <Badge variant={statusTone(audit.status)}>{getLocalizedAuditStatus(audit.status, t)}</Badge>
        <span>{t("nativeChain.auditNumber", { auditId: String(audit.auditId) })}</span>
      </div>
      <span className="text-xs text-muted-foreground">{t("nativeChain.score")} {String(Number(audit.auditScore))}</span>
    </Link>
  );
}

function ScoreRadar({ scores }: { scores: DimensionalScoresOnChain }): JSX.Element {
  const { t } = useTranslation("detail");
  const items: AuditDimensionRadarItem[] = SCORE_DIMENSIONS.map(({ key }) => ({
    key,
    label: t(`nativeChain.dimensions.${key}`),
    value: normalizeBasisPointScore(scores[key])
  }));

  return (
    <AuditDimensionRadar items={items} />
  );
}

function getLocalizedAuditStatus(status: bigint | number, t: (key: string) => string): string {
  return t(`nativeChain.status.${getAuditStatusLabel(status)}`);
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
  title
}: {
  label: string;
  value: string;
  mono?: boolean;
  title?: string;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 truncate text-sm text-foreground",
          mono && "font-mono text-xs"
        )}
        title={title ?? value}
      >
        {value}
      </dd>
    </div>
  );
}
