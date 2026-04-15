import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { AgentListItem, type AgentListEntry } from "./AgentListItem";

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
} as const;

const agentFixture: AgentListEntry = {
  tokenId: "1",
  agentName: "Sentinel",
  developer: "0x1111111111111111111111111111111111111111",
  latestStatus: 1,
  latestScore: 92,
  auditCount: 5n
};

describe("AgentListItem", () => {
  it("renders agent name, token ID, and status", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <AgentListItem agent={agentFixture} />
      </MemoryRouter>
    );

    expect(screen.getByText("Sentinel")).toBeInTheDocument();
    expect(screen.getByText("Token #1")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });

  it("renders score and audit count", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <AgentListItem agent={agentFixture} />
      </MemoryRouter>
    );

    expect(screen.getByText("Score: 92")).toBeInTheDocument();
    expect(screen.getByText("Audits: 5")).toBeInTheDocument();
  });

  it("links to the agent detail page", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <AgentListItem agent={agentFixture} />
      </MemoryRouter>
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/agent/1");
  });

  it("renders a fallback name when agentName is empty", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <AgentListItem agent={{ ...agentFixture, agentName: "" }} />
      </MemoryRouter>
    );

    expect(screen.getByText("Agent #1")).toBeInTheDocument();
  });

  it("renders 'No audits' when latestStatus is null", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <AgentListItem
          agent={{ ...agentFixture, latestStatus: null, latestScore: null }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("No audits")).toBeInTheDocument();
    expect(screen.getByText("Score: --")).toBeInTheDocument();
  });

  it("truncates long developer address", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <AgentListItem agent={agentFixture} />
      </MemoryRouter>
    );

    expect(screen.getByText("0x1111...1111")).toBeInTheDocument();
  });
});
