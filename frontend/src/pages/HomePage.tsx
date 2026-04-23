import { useMemo, useState } from "react";

import { AgentList } from "../components/AgentList";
import type { AgentListEntry } from "../components/AgentListItem";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { MarketplaceHero } from "../components/MarketplaceHero";
import { NavHeader } from "../components/NavHeader";
import {
  SearchFilterBar,
  type RiskLevelFilter,
  type AttestationFilter
} from "../components/SearchFilterBar";
import type { AppConfig } from "../config/appConfig";
import { useAgentList } from "../hooks/useAgentList";
import type { AuditStatusFilter } from "../lib/auditStatus";
import { matchesStatusFilter } from "../lib/auditStatus";
import {
  createAgentAuditRegistryClient,
  createAgentAuditRegistryV2Client,
  type AgentAuditRegistryReadContract,
  type AgentAuditRegistryV2Client
} from "../lib/agentAuditRegistryClient";
import { createMarketplaceClient, type MarketplaceClient } from "../lib/marketplaceClient";
import marketplaceArtifact from "../../../contracts/artifacts/AgentMarketplace.json";

interface HomePageProps {
  config: AppConfig;
  client?: AgentAuditRegistryReadContract;
  v2Client?: AgentAuditRegistryV2Client;
  marketplaceClient?: MarketplaceClient;
}

export function HomePage({ config, client, v2Client, marketplaceClient }: HomePageProps): JSX.Element {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AuditStatusFilter>("all");
  const [riskLevelFilter, setRiskLevelFilter] = useState<RiskLevelFilter>("all");
  const [attestationFilter, setAttestationFilter] = useState<AttestationFilter>("all");

  const [resolvedClient] = useState<AgentAuditRegistryReadContract>(
    () => client ?? createAgentAuditRegistryClient(config)
  );
  const [resolvedV2Client] = useState<AgentAuditRegistryV2Client>(
    () => v2Client ?? createAgentAuditRegistryV2Client(config.registryAddress, config.rpcUrl, config.chainId)
  );
  const [resolvedMarketplaceClient] = useState<MarketplaceClient | undefined>(
    () => {
      if (marketplaceClient) return marketplaceClient;
      if (config.marketplaceAddress) {
        return createMarketplaceClient(
          config.marketplaceAddress,
          marketplaceArtifact.abi,
          config.rpcUrl,
          config.chainId
        );
      }
      return undefined;
    }
  );

  const agentList = useAgentList({
    client: resolvedClient,
    v2Client: resolvedV2Client,
    marketplaceClient: resolvedMarketplaceClient
  });

  const filteredAgents = useMemo(() => {
    return filterAgents(
      agentList.agents,
      searchQuery,
      statusFilter,
      riskLevelFilter,
      attestationFilter
    );
  }, [agentList.agents, searchQuery, statusFilter, riskLevelFilter, attestationFilter]);

  const stats = useMemo(() => computeStats(agentList.agents), [agentList.agents]);

  const hasActiveFilters =
    searchQuery.length > 0 ||
    statusFilter !== "all" ||
    riskLevelFilter !== "all" ||
    attestationFilter !== "all";

  return (
    <main className="app-shell-full">
      <NavHeader />
      <div className="page-content">
        <MarketplaceHero
          totalAgents={stats.total}
          attestedCount={stats.attested}
          averageScore={stats.averageScore}
        />

        <section className="agent-browser-section">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            riskLevelFilter={riskLevelFilter}
            onRiskLevelFilterChange={setRiskLevelFilter}
            attestationFilter={attestationFilter}
            onAttestationFilterChange={setAttestationFilter}
          />

          {agentList.status === "loading" ? (
            <LoadingSkeleton lines={6} title="Loading agents" />
          ) : agentList.status === "error" ? (
            <section className="hero-card">
              <p className="eyebrow">Registry scan</p>
              <h2>Unable to load agents</h2>
              <p className="intro">{agentList.errorMessage ?? "The registry scan failed."}</p>
            </section>
          ) : (
            <AgentList
              agents={filteredAgents}
              hasMore={agentList.hasMore && !hasActiveFilters}
              isLoadingMore={agentList.isLoadingMore}
              onLoadMore={agentList.loadMore}
              emptyTitle={
                hasActiveFilters
                  ? "No matching agents"
                  : "No agents registered"
              }
              emptyDescription={
                hasActiveFilters
                  ? "No agents match your search criteria. Try adjusting your filters."
                  : "There are no registered agents on this registry yet."
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}

function filterAgents(
  agents: readonly AgentListEntry[],
  searchQuery: string,
  statusFilter: AuditStatusFilter,
  riskLevelFilter: RiskLevelFilter,
  attestationFilter: AttestationFilter
): AgentListEntry[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return agents.filter((agent) => {
    if (normalizedQuery.length > 0) {
      const nameMatch = agent.agentName.toLowerCase().includes(normalizedQuery);
      const idMatch = agent.tokenId.includes(normalizedQuery);
      if (!nameMatch && !idMatch) {
        return false;
      }
    }

    if (statusFilter !== "all") {
      if (agent.latestStatus === null) {
        if (statusFilter !== "pending") return false;
      } else if (!matchesStatusFilter(agent.latestStatus, statusFilter)) {
        return false;
      }
    }

    if (riskLevelFilter !== "all") {
      if (!agent.riskLevel) return false;
      if (agent.riskLevel.level !== riskLevelFilter) return false;
    }

    if (attestationFilter === "verified" && !agent.attestationVerified) {
      return false;
    }
    if (attestationFilter === "unverified" && agent.attestationVerified) {
      return false;
    }

    return true;
  });
}

interface AgentStats {
  total: number;
  attested: number;
  averageScore: number | null;
}

function computeStats(agents: readonly AgentListEntry[]): AgentStats {
  const total = agents.length;
  const attested = agents.filter((a) => a.attestationVerified).length;

  const scores = agents
    .filter((a) => a.latestScore !== null)
    .map((a) => Number(a.latestScore));
  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : null;

  return { total, attested, averageScore };
}
