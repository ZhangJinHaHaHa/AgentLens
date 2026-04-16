import { useState } from "react";
import { useParams } from "react-router-dom";

import { AgentProfileCard } from "../components/AgentProfileCard";
import { AuditHistoryList } from "../components/AuditHistoryList";
import { ConfigPanel } from "../components/ConfigPanel";
import { EmptyState } from "../components/EmptyState";
import { LatestAuditSummary } from "../components/LatestAuditSummary";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { NavHeader } from "../components/NavHeader";
import { ReviewSection } from "../components/ReviewSection";
import type { AppConfig } from "../config/appConfig";
import { createAgentAuditRegistryClient, type AgentAuditRegistryReadContract } from "../lib/agentAuditRegistryClient";
import { parseTokenIdInput } from "../lib/tokenId";
import { useAgentCredit } from "../hooks/useAgentCredit";
import { useAuditHistory } from "../hooks/useAuditHistory";
import { useAgentReviews } from "../hooks/useAgentReviews";

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
    client: resolvedClient
  });
  const auditHistory = useAuditHistory({
    tokenId: parsedTokenId.value,
    client: resolvedClient
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
          <p className="eyebrow">Agent detail</p>
          <h1>{agentCredit.profile.agentName || `Agent ${tokenId}`}</h1>
          <p className="intro">{`Connected to chain ${config.chainId}. Summary-only registry reads are active.`}</p>
        </section>
        <AgentProfileCard profile={agentCredit.profile} />
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
