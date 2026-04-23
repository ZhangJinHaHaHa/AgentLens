import { useState } from "react";
import { useParams } from "react-router-dom";

import { AgentProfileCard } from "../components/AgentProfileCard";
import { AuditHistoryList } from "../components/AuditHistoryList";
import { ConfigPanel } from "../components/ConfigPanel";
import { EmptyState } from "../components/EmptyState";
import { LatestAuditSummary } from "../components/LatestAuditSummary";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { NavHeader } from "../components/NavHeader";
import { ReputationBadge } from "../components/ReputationBadge";
import { PricingCard } from "../components/PricingCard";
import { RiskProfileCard } from "../components/RiskProfileCard";
import { AccessHistoryCard } from "../components/AccessHistoryCard";
import { ReviewSection } from "../components/ReviewSection";
import { TrustGuaranteeCard } from "../components/TrustGuaranteeCard";
import type { AppConfig } from "../config/appConfig";
import {
  createAgentAuditRegistryClient,
  createAgentAuditRegistryV2Client,
  type AgentAuditRegistryReadContract,
  type AgentAuditRegistryV2Client
} from "../lib/agentAuditRegistryClient";
import { parseTokenIdInput } from "../lib/tokenId";
import { useAgentCredit } from "../hooks/useAgentCredit";
import { useAgentPricing } from "../hooks/useAgentPricing";
import { useAgentRiskProfile } from "../hooks/useAgentRiskProfile";
import { useAuditHistory } from "../hooks/useAuditHistory";
import { useAccessHistory } from "../hooks/useAccessHistory";
import { useAgentReviews } from "../hooks/useAgentReviews";
import { createMarketplaceClient, type MarketplaceClient } from "../lib/marketplaceClient";
import marketplaceArtifact from "../../../contracts/artifacts/AgentMarketplace.json";

interface AgentDetailPageProps {
  config: AppConfig;
  client?: AgentAuditRegistryReadContract;
}

export function AgentDetailPage({ config, client }: AgentDetailPageProps): JSX.Element {
  const { tokenId = "" } = useParams();
  const parsedTokenId = parseTokenIdInput(tokenId);
  const [resolvedClient] = useState<AgentAuditRegistryReadContract>(
    () => client ?? createAgentAuditRegistryClient(config)
  );
  const [v2Client] = useState<AgentAuditRegistryV2Client>(
    () => createAgentAuditRegistryV2Client(config.registryAddress, config.rpcUrl, config.chainId)
  );
  const [resolvedMarketplaceClient] = useState<MarketplaceClient | null>(
    () => config.marketplaceAddress
      ? createMarketplaceClient(config.marketplaceAddress, marketplaceArtifact.abi, config.rpcUrl, config.chainId)
      : null
  );

  if (!parsedTokenId.ok) {
    return (
      <main className="app-shell-full">
        <NavHeader backHref="/" backLabel="Home" />
        <div className="page-content">
          <EmptyState
            title="Invalid token ID"
            description="The route parameter must be a non-empty decimal tokenId."
          />
        </div>
      </main>
    );
  }

  const agentCredit = useAgentCredit({
    tokenId: parsedTokenId.value,
    client: resolvedClient,
    v2Client
  });
  const riskProfile = useAgentRiskProfile({
    tokenId: parsedTokenId.value,
    v2Client,
    reputationScore: agentCredit.reputation?.currentReputationScore ?? 5000,
    auditCount: agentCredit.profile ? Number(agentCredit.profile.auditCount) : 0,
    attestationVerified: false
  });
  const agentPricing = useAgentPricing({
    tokenId: parsedTokenId.value,
    marketplaceClient: resolvedMarketplaceClient
  });
  const auditHistory = useAuditHistory({
    tokenId: parsedTokenId.value,
    client: resolvedClient
  });
  const accessHistory = useAccessHistory({
    tokenId: String(parsedTokenId.value),
    marketplaceClient: resolvedMarketplaceClient ?? undefined
  });
  const agentReviews = useAgentReviews({ tokenId });

  if (agentCredit.status === "error") {
    return (
      <main className="app-shell-full">
        <NavHeader backHref="/" backLabel="Home" />
        <div className="page-content">
          <EmptyState
            title={agentCredit.errorCode === "TOKEN_NOT_FOUND" ? "Agent not found" : "Unable to load agent credit"}
            description={agentCredit.errorMessage ?? "The registry read failed."}
          />
        </div>
      </main>
    );
  }

  if (agentCredit.status === "loading") {
    return (
      <main className="app-shell-full">
        <NavHeader backHref="/" backLabel="Home" />
        <div className="page-content">
          <LoadingSkeleton lines={6} title="Loading agent profile" />
          <LoadingSkeleton lines={4} title="Loading audit summary" />
        </div>
      </main>
    );
  }

  if (agentCredit.profile === null) {
    return (
      <main className="app-shell-full">
        <NavHeader backHref="/" backLabel="Home" />
        <div className="page-content">
          <EmptyState
            title="Unable to load agent credit"
            description="The registry returned an empty profile unexpectedly."
          />
        </div>
      </main>
    );
  }

  const totalCount = auditHistory.totalCount || toSafeCount(agentCredit.profile.auditCount);
  const latestAuditReportHref =
    agentCredit.latestAudit && totalCount > 0
      ? `/agent/${tokenId}/audits/${String(agentCredit.latestAudit.auditId)}/${totalCount - 1}`
      : undefined;

  return (
    <main className="app-shell-full">
      <NavHeader backHref="/" backLabel="Home" />
      <div className="page-content">
        <section className="hero-card">
          <p className="eyebrow">Agent Profile</p>
          <h1>{agentCredit.profile.agentName || `Agent ${tokenId}`}</h1>
          <p className="intro">
            {`Verified on-chain. ${Number(agentCredit.profile.auditCount)} audit${Number(agentCredit.profile.auditCount) !== 1 ? "s" : ""} completed.`}
          </p>
        </section>
        <AgentProfileCard profile={agentCredit.profile} />
        {agentPricing.status === "ready" && agentPricing.pricing ? (
          <PricingCard
            pricePerDay={agentPricing.pricing.pricePerDay}
            buyPrice={agentPricing.pricing.buyPrice}
            configured={agentPricing.pricing.configured}
            accessCount={agentPricing.accessCount}
          />
        ) : null}
        {agentCredit.reputation !== null ? (
          <ReputationBadge
            currentReputationScore={agentCredit.reputation.currentReputationScore}
            successfulAppeals={agentCredit.reputation.successfulAppeals}
            failedAppeals={agentCredit.reputation.failedAppeals}
            reputationDelta={agentCredit.reputation.reputationDelta}
          />
        ) : null}
        {riskProfile.status === "ready" && riskProfile.riskProfile ? (
          <RiskProfileCard
            riskProfile={riskProfile.riskProfile}
            averageScores={riskProfile.averageScores}
          />
        ) : riskProfile.status === "loading" ? (
          <LoadingSkeleton lines={4} title="Loading risk profile" />
        ) : null}
        {agentCredit.reputation !== null ? (
          <TrustGuaranteeCard
            totalBond={agentCredit.profile.totalBond}
            reputationScore={agentCredit.reputation.currentReputationScore}
            auditCount={Number(agentCredit.profile.auditCount)}
            successfulAppeals={agentCredit.reputation.successfulAppeals}
            failedAppeals={agentCredit.reputation.failedAppeals}
            blacklisted={agentCredit.profile.blacklisted}
          />
        ) : null}
        {agentCredit.latestAudit ? (
          <LatestAuditSummary audit={agentCredit.latestAudit} reportHref={latestAuditReportHref} />
        ) : agentCredit.errorCode === "NO_AUDIT_RECORD" ? (
          <EmptyState
            title="No audit record yet"
            description="This identity exists on-chain, but it has not recorded an audit summary yet."
          />
        ) : null}
        {auditHistory.status === "loading" ? (
          <LoadingSkeleton lines={5} title="Loading audit history" />
        ) : null}
        {auditHistory.status === "ready" && auditHistory.records.length > 0 ? (
          <AuditHistoryList
            tokenId={tokenId}
            records={auditHistory.records}
            totalCount={totalCount}
            hasMore={auditHistory.hasMore}
            isLoadingMore={auditHistory.isLoadingMore}
            onLoadMore={auditHistory.loadMore}
          />
        ) : null}
        {auditHistory.status === "error" ? (
          <EmptyState
            title="Unable to load audit history"
            description={auditHistory.errorMessage ?? "The history query failed."}
          />
        ) : null}
        {accessHistory.status === "ready" ? (
          <AccessHistoryCard
            records={accessHistory.records}
            totalCount={accessHistory.totalCount}
          />
        ) : null}
        {agentReviews.status === "loading" ? (
          <LoadingSkeleton lines={4} title="Loading reviews" />
        ) : agentReviews.status === "ready" ? (
          <ReviewSection
            tokenId={tokenId}
            goodRatios={agentReviews.distribution.goodRatios}
            neutralRatios={agentReviews.distribution.neutralRatios}
            reviews={agentReviews.reviews}
            hasAccess={agentReviews.hasAccess}
            hasReviewed={agentReviews.hasReviewed}
          />
        ) : null}
        <ConfigPanel config={config} />
      </div>
    </main>
  );
}

function toSafeCount(value: bigint | number): number {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}
