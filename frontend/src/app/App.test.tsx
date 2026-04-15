import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { App } from "./App";

const validEnv = {
  VITE_AUDIT_RPC_URL: "https://rpc.edge.local",
  VITE_AUDIT_REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111",
  VITE_AUDIT_CHAIN_ID: "31337"
};

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
} as const;

// Mock the agentAuditRegistryClient to prevent real contract calls
vi.mock("../lib/agentAuditRegistryClient", () => ({
  createAgentAuditRegistryClient: () => ({
    getAgentProfile: vi.fn().mockRejectedValue(new Error("execution reverted: TOKEN_NOT_FOUND")),
    getLatestAuditReport: vi.fn().mockRejectedValue(new Error("execution reverted: TOKEN_NOT_FOUND")),
    getAuditCount: vi.fn().mockRejectedValue(new Error("execution reverted: TOKEN_NOT_FOUND")),
    getAuditReportByIndex: vi.fn().mockRejectedValue(new Error("execution reverted: TOKEN_NOT_FOUND"))
  })
}));

describe("App", () => {
  it("renders a tokenId query surface", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <App env={validEnv} />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/tokenid/i)).toBeInTheDocument();
  });

  it("renders a dedicated configuration error state when frontend config is missing", () => {
    render(
      <MemoryRouter initialEntries={["/agent/1"]} future={routerFuture}>
        <App
          env={{
            VITE_AUDIT_RPC_URL: "",
            VITE_AUDIT_REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111",
            VITE_AUDIT_CHAIN_ID: "31337"
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /configuration required/i })).toBeInTheDocument();
    expect(screen.getByText("VITE_AUDIT_RPC_URL is required.")).toBeInTheDocument();
  });
});
