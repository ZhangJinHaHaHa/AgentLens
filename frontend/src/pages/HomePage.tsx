import { useMemo, useState } from "react";
import { AgentList } from "../components/AgentList";
import type { AgentListEntry } from "../components/AgentListItem";
import { LeaderboardSection, type LeaderboardCategory } from "../components/LeaderboardSection";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { MarketplaceHero } from "../components/MarketplaceHero";
import { NavHeader } from "../components/NavHeader";
import {
  SearchFilterBar,
  type RiskLevelFilter,
  type AttestationFilter,
  type TaskTypeFilter,
  type PriceRangeFilter,
  type SortOrder
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

const ETH_LOW_THRESHOLD = 10_000_000_000_000_000n;
const ETH_MID_THRESHOLD = 100_000_000_000_000_000n;

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
  const [taskTypeFilter, setTaskTypeFilter] = useState<TaskTypeFilter>("all");
  const [priceRangeFilter, setPriceRangeFilter] = useState<PriceRangeFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("default");
  const [leaderboardCategory, setLeaderboardCategory] = useState<LeaderboardCategory>("score");

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

  const filteredAndSortedAgents = useMemo(() => {
    const filtered = filterAgents(
      agentList.agents,
      searchQuery,
      statusFilter,
      riskLevelFilter,
      attestationFilter,
      taskTypeFilter,
      priceRangeFilter
    );
    return sortAgents(filtered, sortOrder);
  }, [
    agentList.agents,
    searchQuery,
    statusFilter,
    riskLevelFilter,
    attestationFilter,
    taskTypeFilter,
    priceRangeFilter,
    sortOrder
  ]);

  const stats = useMemo(() => computeStats(agentList.agents), [agentList.agents]);

  const hasActiveFilters =
    searchQuery.length > 0 ||
    statusFilter !== "all" ||
    riskLevelFilter !== "all" ||
    attestationFilter !== "all" ||
    taskTypeFilter !== "all" ||
    priceRangeFilter !== "all";

  return (
    <main className="app-shell-full">
      <NavHeader />
      <div className="page-content">
        <MarketplaceHero
          totalAgents={stats.total}
          attestedCount={stats.attested}
          averageScore={stats.averageScore}
        />

        {agentList.status === "ready" && agentList.agents.length > 0 && !hasActiveFilters ? (
          <LeaderboardSection
            agents={agentList.agents}
            category={leaderboardCategory}
            onCategoryChange={setLeaderboardCategory}
          />
        ) : null}

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
            taskTypeFilter={taskTypeFilter}
            onTaskTypeFilterChange={setTaskTypeFilter}
            priceRangeFilter={priceRangeFilter}
            onPriceRangeFilterChange={setPriceRangeFilter}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
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
              agents={filteredAndSortedAgents}
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
  attestationFilter: AttestationFilter,
  taskTypeFilter: TaskTypeFilter,
  priceRangeFilter: PriceRangeFilter
): AgentListEntry[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  return agents.filter((agent) => {
    if (normalizedQuery.length > 0) {
      const nameMatch = agent.agentName.toLowerCase().includes(normalizedQuery);
      const idMatch = agent.tokenId.includes(normalizedQuery);
      if (!nameMatch && !idMatch) return false;
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
    if (attestationFilter === "verified" && !agent.attestationVerified) return false;
    if (attestationFilter === "unverified" && agent.attestationVerified) return false;
    if (taskTypeFilter !== "all") {
      const name = agent.agentName.toLowerCase();
      const taskKeywords: Record<TaskTypeFilter, string[]> = {
        all: [],
        defi: ["defi", "finance", "swap", "yield", "lending", "trade", "token"],
        chatbot: ["chat", "bot", "support", "customer", "assistant", "qa"],
        devops: ["devops", "deploy", "infra", "ci", "cd", "monitor", "ops"],
        data: ["data", "analysis", "research", "analytics", "insight", "report"],
        automation: ["auto", "workflow", "task", "schedule", "pipeline", "process"]
      };
      const keywords = taskKeywords[taskTypeFilter];
      if (!keywords.some((kw) => name.includes(kw))) return false;
    }
    if (priceRangeFilter !== "all") {
      const ppd = agent.pricing?.configured ? agent.pricing.pricePerDay : null;
      if (priceRangeFilter === "free") {
        if (ppd !== null && ppd > 0n) return false;
      } else if (priceRangeFilter === "low") {
        if (ppd === null || ppd === 0n || ppd >= ETH_LOW_THRESHOLD) return false;
      } else if (priceRangeFilter === "mid") {
        if (ppd === null || ppd < ETH_LOW_THRESHOLD || ppd >= ETH_MID_THRESHOLD) return false;
      } else if (priceRangeFilter === "high") {
        if (ppd === null || ppd < ETH_MID_THRESHOLD) return false;
      }
    }
    return true;
  });
}

function sortAgents(agents: AgentListEntry[], order: SortOrder): AgentListEntry[] {
  if (order === "default") return agents;
  const copy = [...agents];
  switch (order) {
    case "score_desc":
      return copy.sort((a, b) => Number(b.latestScore ?? -1) - Number(a.latestScore ?? -1));
    case "reputation_desc":
      return copy.sort((a, b) => (b.reputationScore ?? -1) - (a.reputationScore ?? -1));
    case "access_desc":
      return copy.sort((a, b) => (b.reputationScore ?? -1) - (a.reputationScore ?? -1));
    case "price_asc":
      return copy.sort((a, b) => {
        const pa = a.pricing?.configured ? Number(a.pricing.pricePerDay) : Infinity;
        const pb = b.pricing?.configured ? Number(b.pricing.pricePerDay) : Infinity;
        return pa - pb;
      });
    case "fresh_desc":
      return copy.sort((a, b) => b.lastAuditAt - a.lastAuditAt);
    default:
      return copy;
  }
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
