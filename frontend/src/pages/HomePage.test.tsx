import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";

import type { AgentAuditRegistryReadContract, AgentProfile, AuditRecord } from "../lib/agentAuditRegistryClient";
import { HomePage } from "./HomePage";

const validConfig = {
  rpcUrl: "https://rpc.edge.local",
  registryAddress: "0x1111111111111111111111111111111111111111",
  chainId: 31337
};

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
} as const;

function DetailRouteEcho(): JSX.Element {
  const { tokenId } = useParams();

  return <div>detail:{tokenId}</div>;
}

function createProfileFixture(tokenId: number, name: string): AgentProfile {
  return {
    developer: "0x1111111111111111111111111111111111111111",
    agentName: name,
    tokenId: BigInt(tokenId),
    totalBond: 1000000000000000000n,
    blacklisted: false,
    createdAt: 1700000000n,
    lastAuditAt: 1700003600n,
    auditCount: 2n
  };
}

function createAuditRecordFixture(): AuditRecord {
  return {
    auditId: 1n,
    timestamp: 1700000000n,
    auditScore: 85,
    memoryPeakMb: 256,
    cpuAvgMilli: 150,
    requestIpCount: 2,
    status: 1,
    manifestHash: `0x${"aa".repeat(32)}`,
    reportHash: `0x${"bb".repeat(32)}`,
    reportCID: "bafy-test",
    manifestUrl: "https://example.com/manifest.json",
    appealRequested: false,
    appealApproved: false
  };
}

function createClientMock(
  overrides: Partial<AgentAuditRegistryReadContract> = {}
): AgentAuditRegistryReadContract {
  return {
    getAgentProfile: vi.fn().mockImplementation(async (tokenId: bigint) => {
      const id = Number(tokenId);
      if (id === 1) {
        return createProfileFixture(1, "Sentinel");
      }
      if (id === 2) {
        return createProfileFixture(2, "Guardian");
      }
      throw new Error("execution reverted: TOKEN_NOT_FOUND");
    }),
    getLatestAuditReport: vi.fn().mockImplementation(async (tokenId: bigint) => {
      const id = Number(tokenId);
      if (id <= 2) {
        return createAuditRecordFixture();
      }
      throw new Error("execution reverted: TOKEN_NOT_FOUND");
    }),
    getAuditCount: vi.fn().mockResolvedValue(2n),
    getAuditReportByIndex: vi.fn().mockResolvedValue(createAuditRecordFixture()),
    ...overrides
  };
}

function renderHomePage(client?: AgentAuditRegistryReadContract): void {
  render(
    <MemoryRouter initialEntries={["/"]} future={routerFuture}>
      <Routes>
        <Route
          path="/"
          element={<HomePage config={validConfig} client={client ?? createClientMock()} />}
        />
        <Route path="/agent/:tokenId" element={<DetailRouteEcho />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("HomePage", () => {
  it("renders a tokenId input and submit button after toggle", () => {
    renderHomePage();

    fireEvent.click(screen.getByText(/direct lookup by token id/i));

    expect(screen.getByLabelText(/tokenid/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("shows local validation feedback and does not navigate for invalid token input", () => {
    renderHomePage();

    fireEvent.click(screen.getByText(/direct lookup by token id/i));
    fireEvent.change(screen.getByLabelText(/tokenid/i), { target: { value: "12.3" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    expect(
      screen.getByText("Token ID must be a non-empty decimal string.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/detail:/i)).not.toBeInTheDocument();
  });

  it("navigates to the detail route when token input is valid", () => {
    renderHomePage();

    fireEvent.click(screen.getByText(/direct lookup by token id/i));
    fireEvent.change(screen.getByLabelText(/tokenid/i), { target: { value: " 00123 " } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    expect(screen.getByText("detail:00123")).toBeInTheDocument();
  });

  it("scans the registry and renders discovered agents", async () => {
    const client = createClientMock();
    renderHomePage(client);

    await waitFor(() => {
      expect(screen.getByText("Sentinel")).toBeInTheDocument();
    });

    expect(screen.getByText("Guardian")).toBeInTheDocument();
  });

  it("filters agents by search query", async () => {
    const client = createClientMock();
    renderHomePage(client);

    await waitFor(() => {
      expect(screen.getByText("Sentinel")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/search by agent name/i), {
      target: { value: "Guard" }
    });

    expect(screen.queryByText("Sentinel")).not.toBeInTheDocument();
    expect(screen.getByText("Guardian")).toBeInTheDocument();
  });

  it("renders a search input for filtering agents", () => {
    renderHomePage();

    expect(screen.getByPlaceholderText(/search by agent name/i)).toBeInTheDocument();
  });

  it("renders status filter radio buttons", () => {
    renderHomePage();

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders empty state when no agents are registered", async () => {
    const client = createClientMock({
      getAgentProfile: vi.fn().mockRejectedValue(new Error("execution reverted: TOKEN_NOT_FOUND")),
      getLatestAuditReport: vi.fn().mockRejectedValue(new Error("execution reverted: TOKEN_NOT_FOUND"))
    });

    renderHomePage(client);

    await waitFor(() => {
      expect(screen.getByText("No agents registered")).toBeInTheDocument();
    });
  });
});
