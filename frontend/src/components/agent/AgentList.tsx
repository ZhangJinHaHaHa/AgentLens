import type { AgentCatalogEntry } from "@/domain/catalog";
import { cn } from "@/lib/utils";

import { AgentCard } from "./AgentCard";

interface AgentListProps {
  entries: AgentCatalogEntry[];
  className?: string;
  emptyState?: React.ReactNode;
}

export function AgentList({
  entries,
  className,
  emptyState
}: AgentListProps): JSX.Element {
  if (entries.length === 0) {
    return <>{emptyState ?? null}</>;
  }
  return (
    <div className={cn("grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {entries.map((entry) => (
        <AgentCard
          key={`${entry.source}:${entry.id}`}
          entry={entry}
        />
      ))}
    </div>
  );
}
