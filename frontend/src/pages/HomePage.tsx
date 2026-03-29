import { type FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AgentList } from "../components/AgentList";
import type { AgentListEntry } from "../components/AgentListItem";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { NavHeader } from "../components/NavHeader";
import { SearchFilterBar } from "../components/SearchFilterBar";
import type { AppConfig } from "../config/appConfig";
import { useAgentList } from "../hooks/useAgentList";
import type { AuditStatusFilter } from "../lib/auditStatus";
import { matchesStatusFilter } from "../lib/auditStatus";
import { createAgentAuditRegistryClient, type AgentAuditRegistryReadContract } from "../lib/agentAuditRegistryClient";
import { parseTokenIdInput } from "../lib/tokenId";

interface HomePageProps {
  config: AppConfig;
  client?: AgentAuditRegistryReadContract;
}

export function HomePage({ config, client }: HomePageProps): JSX.Element {
  const navigate = useNavigate();
  const [tokenId, setTokenId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AuditStatusFilter>("all");
  const [resolvedClient] = useState<AgentAuditRegistryReadContract>(
    () => client ?? createAgentAuditRegistryClient(config)
  );

  const agentList = useAgentList({ client: resolvedClient });

  const filteredAgents = useMemo(() => {
    return filterAgents(agentList.agents, searchQuery, statusFilter);
  }, [agentList.agents, searchQuery, statusFilter]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const parsedTokenId = parseTokenIdInput(tokenId);
    if (!parsedTokenId.ok) {
      setError(parsedTokenId.error);
      return;
    }

    setError(null);
    navigate(`/agent/${parsedTokenId.normalized}`);
  }

  return (
    <main className="app-shell-full">
      <NavHeader />
      <div className="page-content">
        <section className="hero-card">
          <p className="eyebrow">Read-only registry query</p>
          <h1>Agent credit lookup</h1>
          <p className="intro">
            Query an on-chain agent profile by tokenId and inspect the latest audit summary.
          </p>
          <form className="token-form" onSubmit={handleSubmit}>
            <label htmlFor="tokenId">tokenId</label>
            <input
              id="tokenId"
              name="tokenId"
              type="text"
              inputMode="numeric"
              value={tokenId}
              onChange={(event) => setTokenId(event.target.value)}
            />
            {error ? <p role="alert">{error}</p> : null}
            <button type="submit">Search</button>
          </form>
        </section>

        <section className="agent-browser-section">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
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
              hasMore={agentList.hasMore && searchQuery.length === 0 && statusFilter === "all"}
              isLoadingMore={agentList.isLoadingMore}
              onLoadMore={agentList.loadMore}
              emptyTitle={
                searchQuery.length > 0 || statusFilter !== "all"
                  ? "No matching agents"
                  : "No agents registered"
              }
              emptyDescription={
                searchQuery.length > 0 || statusFilter !== "all"
                  ? "No agents match your search criteria. Try adjusting your filters."
                  : "There are no registered agents on this registry yet. Use the lookup form above to search by token ID."
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
  statusFilter: AuditStatusFilter
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
        return statusFilter === "pending";
      }
      return matchesStatusFilter(agent.latestStatus, statusFilter);
    }

    return true;
  });
}
