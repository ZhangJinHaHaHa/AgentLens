import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { AgentList } from "./AgentList";
import type { AgentListEntry } from "./AgentListItem";

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
} as const;

const agentsFixture: AgentListEntry[] = [
  {
    tokenId: "1",
    agentName: "Sentinel",
    developer: "0x1111111111111111111111111111111111111111",
    latestStatus: 1,
    latestScore: 92,
    auditCount: 5n
  },
  {
    tokenId: "2",
    agentName: "Guardian",
    developer: "0x2222222222222222222222222222222222222222",
    latestStatus: 2,
    latestScore: 40,
    auditCount: 3n
  }
];

describe("AgentList", () => {
  it("renders a list of agents", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <AgentList
          agents={agentsFixture}
          hasMore={false}
          isLoadingMore={false}
          onLoadMore={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Sentinel")).toBeInTheDocument();
    expect(screen.getByText("Guardian")).toBeInTheDocument();
  });

  it("renders an empty state when agents array is empty", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <AgentList
          agents={[]}
          hasMore={false}
          isLoadingMore={false}
          onLoadMore={vi.fn()}
          emptyTitle="No agents found"
          emptyDescription="Try a different search."
        />
      </MemoryRouter>
    );

    expect(screen.getByText("No agents found")).toBeInTheDocument();
    expect(screen.getByText("Try a different search.")).toBeInTheDocument();
  });

  it("renders a load more button when hasMore is true", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <AgentList
          agents={agentsFixture}
          hasMore={true}
          isLoadingMore={false}
          onLoadMore={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("does not render the load more button when hasMore is false", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <AgentList
          agents={agentsFixture}
          hasMore={false}
          isLoadingMore={false}
          onLoadMore={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("shows a loading state on the load more button", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <AgentList
          agents={agentsFixture}
          hasMore={true}
          isLoadingMore={true}
          onLoadMore={vi.fn()}
        />
      </MemoryRouter>
    );

    const button = screen.getByRole("button", { name: /loading/i });
    expect(button).toBeDisabled();
  });
});
