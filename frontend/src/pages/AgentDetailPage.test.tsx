import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { AgentAuditRegistryReadContract, AgentProfile, AuditRecord } from "../lib/agentAuditRegistryClient";
import { AgentDetailPage } from "./AgentDetailPage";

const validConfig = {
  rpcUrl: "https://rpc.edge.local",
  registryAddress: "0x1111111111111111111111111111111111111111",
  chainId: 31337
};

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
} as const;

const profileFixture: AgentProfile = {
  developer: "0x1111111111111111111111111111111111111111",
  agentName: "Sentinel",
  tokenId: 1n,
  totalBond: 1000000000000000000n,
  blacklisted: false,
  createdAt: 1700000000n,
  lastAuditAt: 1700003600n,
  auditCount: 2n
};

function createAuditRecord(index: number): AuditRecord {
  return {
    auditId: BigInt(index + 1),
    timestamp: BigInt(1700000000 + index),
    auditScore: 90 - index,
    memoryPeakMb: 512 + index,
    cpuAvgMilli: 200 + index,
    requestIpCount: 4 + index,
    status: 1,
    manifestHash: `0x${"11".repeat(32)}`,
    reportHash: `0x${"22".repeat(32)}`,
    reportCID: `bafy-${index}`,
    manifestUrl: `https://example.com/${index}.json`,
    appealRequested: false,
    appealApproved: false
  };
}

function createClientMock(
  overrides: Partial<AgentAuditRegistryReadContract> = {}
): AgentAuditRegistryReadContract {
  return {
    getAgentProfile: vi.fn().mockResolvedValue(profileFixture),
    getLatestAuditReport: vi.fn().mockResolvedValue(createAuditRecord(1)),
    getAuditCount: vi.fn().mockResolvedValue(2n),
    getAuditReportByIndex: vi.fn().mockImplementation(async (_tokenId: bigint, index: number) => {
      return createAuditRecord(index);
    }),
    ...overrides
  };
}

function renderDetailPage(client: AgentAuditRegistryReadContract): void {
  render(
    <MemoryRouter initialEntries={["/agent/1"]} future={routerFuture}>
      <Routes>
        <Route path="/agent/:tokenId" element={<AgentDetailPage config={validConfig} client={client} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AgentDetailPage", () => {
  it("renders approved summary fields and hides report backsource fields", async () => {
    const client = createClientMock();

    renderDetailPage(client);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /agent profile/i })).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sentinel");
    expect(screen.getByRole("heading", { name: /latest audit summary/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /audit history/i })).toBeInTheDocument();
    expect(screen.getAllByText(/audit #2/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("bafy-1")).not.toBeInTheDocument();
    expect(screen.queryByText("https://example.com/1.json")).not.toBeInTheDocument();
    expect(client.getAgentProfile).toHaveBeenCalledWith(1n);
    expect(client.getLatestAuditReport).toHaveBeenCalledWith(1n);
  });

  it("renders report detail links for the latest summary and history rows", async () => {
    const client = createClientMock();

    renderDetailPage(client);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /latest audit summary/i })).toBeInTheDocument();
    });

    const links = screen.getAllByRole("link", { name: /view/i }).filter((link) => {
      const href = link.getAttribute("href") ?? "";
      return href.includes("/audits/");
    }).map((link) => link.getAttribute("href"));

    expect(links).toContain("/agent/1/audits/2/1");
    expect(links).toContain("/agent/1/audits/1/0");
  });

  it("renders a token-not-found state", async () => {
    const client = createClientMock({
      getAgentProfile: vi.fn().mockRejectedValue(new Error("execution reverted: TOKEN_NOT_FOUND")),
      getLatestAuditReport: vi.fn().mockRejectedValue(new Error("execution reverted: TOKEN_NOT_FOUND")),
      getAuditCount: vi.fn().mockRejectedValue(new Error("execution reverted: TOKEN_NOT_FOUND"))
    });

    renderDetailPage(client);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /agent not found/i })).toBeInTheDocument();
    });
  });

  it("renders a no-audit-record state", async () => {
    const client = createClientMock({
      getLatestAuditReport: vi.fn().mockRejectedValue(new Error("execution reverted: NO_AUDIT_RECORD")),
      getAuditCount: vi.fn().mockResolvedValue(0n)
    });

    renderDetailPage(client);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /no audit record yet/i })).toBeInTheDocument();
    });
  });

  it("renders a generic chain-read failure state", async () => {
    const client = createClientMock({
      getAgentProfile: vi.fn().mockRejectedValue(new Error("socket hang up")),
      getLatestAuditReport: vi.fn().mockRejectedValue(new Error("socket hang up")),
      getAuditCount: vi.fn().mockRejectedValue(new Error("socket hang up"))
    });

    renderDetailPage(client);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /unable to load agent credit/i })).toBeInTheDocument();
    });
  });

  it("renders loading skeletons while data is being fetched", () => {
    const client = createClientMock({
      getAgentProfile: vi.fn().mockReturnValue(new Promise(() => {})),
      getLatestAuditReport: vi.fn().mockReturnValue(new Promise(() => {}))
    });

    renderDetailPage(client);

    expect(screen.getByLabelText("Loading agent profile")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading audit summary")).toBeInTheDocument();
  });

  it("renders a back-to-home navigation link", async () => {
    const client = createClientMock();

    renderDetailPage(client);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /agent profile/i })).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute("href", "/");
  });

  it("renders a config panel toggle", async () => {
    const client = createClientMock();

    renderDetailPage(client);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /agent profile/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/chain configuration/i)).toBeInTheDocument();
  });
});
