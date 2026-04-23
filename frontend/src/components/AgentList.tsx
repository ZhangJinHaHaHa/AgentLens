import { EnhancedAgentCard } from "./EnhancedAgentCard";
import type { AgentListEntry } from "./AgentListItem";
import { EmptyState } from "./EmptyState";

interface AgentListProps {
  agents: readonly AgentListEntry[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function AgentList({
  agents,
  hasMore,
  isLoadingMore,
  onLoadMore,
  emptyTitle = "No agents found",
  emptyDescription = "There are no registered agents matching your search criteria."
}: AgentListProps): JSX.Element {
  if (agents.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <section className="agent-list-section">
      <ul className="agent-list" role="list">
        {agents.map((agent) => (
          <EnhancedAgentCard key={agent.tokenId} agent={agent} />
        ))}
      </ul>
      {hasMore ? (
        <div className="load-more-container">
          <button
            type="button"
            className="load-more-button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
