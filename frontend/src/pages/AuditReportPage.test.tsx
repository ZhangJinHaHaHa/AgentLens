import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { AppConfig } from "../config/appConfig";
import type { AgentAuditRegistryReadContract, AuditRecord } from "../lib/agentAuditRegistryClient";
import type { AuditReportClient, DetailedAuditReport } from "../lib/auditReportClient";
import type { AppealClient } from "../lib/appealClient";
import { AuditReportPage } from "./AuditReportPage";

const validConfig: AppConfig = {
  rpcUrl: "https://rpc.edge.local",
  registryAddress: "0x1111111111111111111111111111111111111111",
  chainId: 31337,
  reportGatewayUrl: "https://gateway.example/ipfs/",
  appealApiUrl: "https://api.example.com/appeals"
};

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
} as const;

const auditRecordFixture: AuditRecord = {
  auditId: 2n,
  timestamp: 1700003600n,
  auditScore: 91,
  memoryPeakMb: 512,
  cpuAvgMilli: 220,
  requestIpCount: 4,
  status: 1,
  manifestHash: `0x${"11".repeat(32)}`,
  reportHash: `0x${"22".repeat(32)}`,
  reportCID: "bafy-latest",
  manifestUrl: "https://example.com/manifest.json",
  appealRequested: false,
  appealApproved: false
};

const reportFixture: DetailedAuditReport = {
  schemaVersion: "audit-report.v1",
  agentName: "Sentinel",
  manifestHash: "manifest-hash-123",
  status: "completed",
  decisionType: "undetermined",
  reasonCode: "ACTION_MISMATCH",
  healthcheckPassed: true,
  resourceMetrics: {
    cpuAvgMilli: 220,
    memoryPeakMb: 512
  },
  networkActivity: {
    requestedIps: ["203.0.113.10"],
    requestedHosts: ["api.example.com"],
    requestCount: 1
  },
  responseTrace: {
    answer: "safe result",
    actions: [{ type: "web_request", url: "https://api.example.com/v1" }]
  },
  timestamps: {
    startedAt: "2026-03-30T09:00:00.000Z",
    finishedAt: "2026-03-30T09:00:01.000Z"
  }
};

function createClientMock(
  overrides: Partial<AgentAuditRegistryReadContract> = {}
): AgentAuditRegistryReadContract {
  return {
    getAgentProfile: vi.fn(),
    getLatestAuditReport: vi.fn(),
    getAuditCount: vi.fn(),
    getAuditReportByIndex: vi.fn().mockResolvedValue(auditRecordFixture),
    ...overrides
  };
}

function createReportClientMock(result: Awaited<ReturnType<AuditReportClient["readReportByCid"]>>): AuditReportClient {
  return {
    readReportByCid: vi.fn().mockResolvedValue(result)
  };
}

function createAppealClientMock(args: {
  submitResult?: Awaited<ReturnType<AppealClient["submitAppeal"]>>;
  readResult?: Awaited<ReturnType<AppealClient["readLatestAppeal"]>>;
}): AppealClient {
  return {
    submitAppeal: vi.fn().mockResolvedValue(
      args.submitResult ?? {
        ok: true,
        appealId: "apl-001",
        status: "reviewing"
      }
    ),
    readLatestAppeal: vi.fn().mockResolvedValue(
      args.readResult ?? {
        ok: false,
        errorCode: "NOT_FOUND",
        error: "Appeal not found."
      }
    )
  };
}

function renderAuditReportPage(
  client: AgentAuditRegistryReadContract,
  reportClient?: AuditReportClient,
  appealClient?: AppealClient,
  config = validConfig
): void {
  render(
    <MemoryRouter initialEntries={["/agent/1/audits/2/1"]} future={routerFuture}>
      <Routes>
        <Route
          path="/agent/:tokenId/audits/:auditId/:auditIndex"
          element={
            <AuditReportPage
              config={config}
              client={client}
              reportClient={reportClient}
              appealClient={appealClient}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("AuditReportPage", () => {
  it("loads the on-chain audit record, fetches the detailed report, and renders verified content", async () => {
    const client = createClientMock();
    const reportClient = createReportClientMock({
      ok: true,
      report: reportFixture,
      reportJson: JSON.stringify(reportFixture, null, 2),
      sourceUrl: "https://gateway.example/ipfs/bafy-latest"
    });

    renderAuditReportPage(client, reportClient);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /audit report #2/i })).toBeInTheDocument();
    });

    expect(screen.getAllByText(/hash verified/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Sentinel")).toBeInTheDocument();
    expect(screen.getByText("https://gateway.example/ipfs/bafy-latest")).toBeInTheDocument();
    expect(screen.getByText("manifest-hash-123")).toBeInTheDocument();
    expect(screen.getByText("bafy-latest")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/manifest.json")).toBeInTheDocument();
    expect(screen.getByText("ACTION_MISMATCH")).toBeInTheDocument();
    expect(screen.getByText("2026-03-30T09:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("2026-03-30T09:00:01.000Z")).toBeInTheDocument();
    expect(screen.getByText("203.0.113.10")).toBeInTheDocument();
    expect(screen.getByText("api.example.com")).toBeInTheDocument();
    expect(screen.getByText("https://api.example.com/v1")).toBeInTheDocument();
    expect(client.getAuditReportByIndex).toHaveBeenCalledWith(1n, 1);
    expect(reportClient.readReportByCid).toHaveBeenCalledWith({
      reportCID: "bafy-latest",
      expectedReportHash: auditRecordFixture.reportHash
    });
  });

  it("renders a hash-mismatch state when report verification fails", async () => {
    const client = createClientMock();
    const reportClient = createReportClientMock({
      ok: false,
      errorCode: "HASH_MISMATCH",
      error: "Detailed audit report hash verification failed.",
      sourceUrl: "https://ipfs.io/ipfs/bafy-latest"
    });

    renderAuditReportPage(client, reportClient);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /report verification failed/i })).toBeInTheDocument();
    });
  });

  it("renders the on-chain summary when reportCID is empty", async () => {
    const client = createClientMock({
      getAuditReportByIndex: vi.fn().mockResolvedValue({
        ...auditRecordFixture,
        reportCID: ""
      })
    });
    const reportClient = createReportClientMock({
      ok: false,
      errorCode: "REPORT_UNAVAILABLE",
      error: "This audit summary does not include a report CID yet."
    });

    renderAuditReportPage(client, reportClient);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /audit report #2/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/detailed report is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(auditRecordFixture.reportHash)).toBeInTheDocument();
    expect(screen.getByText("https://example.com/manifest.json")).toBeInTheDocument();
    expect(screen.queryByText("Sentinel")).not.toBeInTheDocument();
  });

  it("uses the configured report gateway url when the page builds its own report client", async () => {
    const reportJson = JSON.stringify(reportFixture, null, 2);
    const expectedHash = await computeSha256Hex(reportJson);
    const client = createClientMock({
      getAuditReportByIndex: vi.fn().mockResolvedValue({
        ...auditRecordFixture,
        reportHash: expectedHash
      })
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(reportJson, { status: 200 }));

    renderAuditReportPage(client);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /audit report #2/i })).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith("https://gateway.example/ipfs/bafy-latest");
    fetchSpy.mockRestore();
  });

  it("renders appeal review state from the on-chain audit record", async () => {
    const client = createClientMock({
      getAuditReportByIndex: vi.fn().mockResolvedValue({
        ...auditRecordFixture,
        status: 3,
        appealRequested: true,
        appealApproved: false
      })
    });
    const reportClient = createReportClientMock({
      ok: true,
      report: reportFixture,
      reportJson: JSON.stringify(reportFixture, null, 2),
      sourceUrl: "https://gateway.example/ipfs/bafy-latest"
    });

    renderAuditReportPage(client, reportClient);

    await waitFor(() => {
      expect(screen.getByText("Appeal in review")).toBeInTheDocument();
    });
  });

  it("renders an appeal form for slashed audits that have not been appealed yet", async () => {
    const client = createClientMock({
      getAuditReportByIndex: vi.fn().mockResolvedValue({
        ...auditRecordFixture,
        status: 3,
        appealRequested: false,
        appealApproved: false
      })
    });
    const reportClient = createReportClientMock({
      ok: true,
      report: reportFixture,
      reportJson: JSON.stringify(reportFixture, null, 2),
      sourceUrl: "https://gateway.example/ipfs/bafy-latest"
    });

    renderAuditReportPage(client, reportClient);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /submit appeal/i })).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/appeal reason/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit appeal/i })).toBeInTheDocument();
  });

  it("submits an appeal for a slashed audit and switches the page into review state", async () => {
    const client = createClientMock({
      getAuditReportByIndex: vi.fn().mockResolvedValue({
        ...auditRecordFixture,
        status: 3,
        appealRequested: false,
        appealApproved: false
      })
    });
    const reportClient = createReportClientMock({
      ok: true,
      report: reportFixture,
      reportJson: JSON.stringify(reportFixture, null, 2),
      sourceUrl: "https://gateway.example/ipfs/bafy-latest"
    });
    const appealClient = createAppealClientMock({
      submitResult: {
        ok: true,
        appealId: "apl-001",
        status: "reviewing"
      }
    });

    renderAuditReportPage(client, reportClient, appealClient);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit appeal/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/appeal reason/i), {
      target: { value: "The slash appears to be a false positive caused by a declared integration." }
    });
    fireEvent.click(screen.getByRole("button", { name: /submit appeal/i }));

    await waitFor(() => {
      expect(appealClient.submitAppeal).toHaveBeenCalledWith({
        tokenId: 1n,
        auditId: 2n,
        auditIndex: 1,
        reason: "The slash appears to be a false positive caused by a declared integration.",
        reportCID: "bafy-latest",
        reportHash: auditRecordFixture.reportHash,
        manifestUrl: "https://example.com/manifest.json"
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Appeal in review")).toBeInTheDocument();
    });
  });

  it("renders an inline error when appeal submission fails", async () => {
    const client = createClientMock({
      getAuditReportByIndex: vi.fn().mockResolvedValue({
        ...auditRecordFixture,
        status: 3,
        appealRequested: false,
        appealApproved: false
      })
    });
    const reportClient = createReportClientMock({
      ok: true,
      report: reportFixture,
      reportJson: JSON.stringify(reportFixture, null, 2),
      sourceUrl: "https://gateway.example/ipfs/bafy-latest"
    });
    const appealClient = createAppealClientMock({
      submitResult: {
        ok: false,
        error: "Appeal reason is too short."
      }
    });

    renderAuditReportPage(client, reportClient, appealClient);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit appeal/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/appeal reason/i), {
      target: { value: "Need review." }
    });
    fireEvent.click(screen.getByRole("button", { name: /submit appeal/i }));

    await waitFor(() => {
      expect(screen.getByText("Appeal reason is too short.")).toBeInTheDocument();
    });
  });

  it("explains when the frontend has no appeal endpoint configured", async () => {
    const client = createClientMock({
      getAuditReportByIndex: vi.fn().mockResolvedValue({
        ...auditRecordFixture,
        status: 3,
        appealRequested: false,
        appealApproved: false
      })
    });
    const reportClient = createReportClientMock({
      ok: true,
      report: reportFixture,
      reportJson: JSON.stringify(reportFixture, null, 2),
      sourceUrl: "https://gateway.example/ipfs/bafy-latest"
    });

    renderAuditReportPage(client, reportClient, undefined, {
      ...validConfig,
      appealApiUrl: undefined
    });

    await waitFor(() => {
      expect(screen.getByText(/appeal submission is unavailable/i)).toBeInTheDocument();
    });
  });

  it("hydrates the appeal review state from the appeal api when chain state is not updated yet", async () => {
    const client = createClientMock({
      getAuditReportByIndex: vi.fn().mockResolvedValue({
        ...auditRecordFixture,
        status: 3,
        appealRequested: false,
        appealApproved: false
      })
    });
    const reportClient = createReportClientMock({
      ok: true,
      report: reportFixture,
      reportJson: JSON.stringify(reportFixture, null, 2),
      sourceUrl: "https://gateway.example/ipfs/bafy-latest"
    });
    const appealClient = createAppealClientMock({
      readResult: {
        ok: true,
        appealId: "apl-009",
        status: "reviewing",
        createdAt: "2026-03-30T11:00:00.000Z"
      }
    });

    renderAuditReportPage(client, reportClient, appealClient);

    await waitFor(() => {
      expect(appealClient.readLatestAppeal).toHaveBeenCalledWith({
        tokenId: 1n,
        auditId: 2n
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Appeal in review")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /submit appeal/i })).not.toBeInTheDocument();
  });

  it("renders approved appeal state from the appeal api", async () => {
    const client = createClientMock({
      getAuditReportByIndex: vi.fn().mockResolvedValue({
        ...auditRecordFixture,
        status: 3,
        appealRequested: false,
        appealApproved: false
      })
    });
    const reportClient = createReportClientMock({
      ok: true,
      report: reportFixture,
      reportJson: JSON.stringify(reportFixture, null, 2),
      sourceUrl: "https://gateway.example/ipfs/bafy-latest"
    });

    renderAuditReportPage(
      client,
      reportClient,
      createAppealClientMock({
        readResult: {
          ok: true,
          appealId: "apl-010",
          status: "approved",
          createdAt: "2026-03-30T11:05:00.000Z"
        }
      })
    );

    await waitFor(() => {
      expect(screen.getByText("Appeal approved")).toBeInTheDocument();
    });
    expect(
      screen.getByText("This slashed audit has already been compensated after review.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit appeal/i })).not.toBeInTheDocument();
  });

  it("renders rejected appeal state from the appeal api", async () => {
    const client = createClientMock({
      getAuditReportByIndex: vi.fn().mockResolvedValue({
        ...auditRecordFixture,
        status: 3,
        appealRequested: false,
        appealApproved: false
      })
    });
    const reportClient = createReportClientMock({
      ok: true,
      report: reportFixture,
      reportJson: JSON.stringify(reportFixture, null, 2),
      sourceUrl: "https://gateway.example/ipfs/bafy-latest"
    });

    renderAuditReportPage(
      client,
      reportClient,
      createAppealClientMock({
        readResult: {
          ok: true,
          appealId: "apl-011",
          status: "rejected",
          createdAt: "2026-03-30T11:06:00.000Z"
        }
      })
    );

    await waitFor(() => {
      expect(screen.getByText("Appeal rejected")).toBeInTheDocument();
    });
    expect(screen.getByText("This slashed audit appeal was rejected in review.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit appeal/i })).not.toBeInTheDocument();
  });

  it("renders evidence information section with hash verification status", async () => {
    const client = createClientMock();
    const reportClient = createReportClientMock({
      ok: true,
      report: reportFixture,
      reportJson: JSON.stringify(reportFixture, null, 2),
      sourceUrl: "https://gateway.example/ipfs/bafy-latest"
    });

    renderAuditReportPage(client, reportClient);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /evidence information/i })).toBeInTheDocument();
    });

    expect(screen.getByText("Hash verified")).toBeInTheDocument();
  });

  it("renders a raw JSON viewer toggle for verified reports", async () => {
    const client = createClientMock();
    const reportJson = JSON.stringify(reportFixture, null, 2);
    const reportClient = createReportClientMock({
      ok: true,
      report: reportFixture,
      reportJson,
      sourceUrl: "https://gateway.example/ipfs/bafy-latest"
    });

    renderAuditReportPage(client, reportClient);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /raw report json/i })).toBeInTheDocument();
    });

    const expandButton = screen.getByText("Expand");
    expect(expandButton).toBeInTheDocument();
  });

  it("renders loading skeletons while data is loading", () => {
    const client = createClientMock({
      getAuditReportByIndex: vi.fn().mockReturnValue(new Promise(() => {}))
    });

    renderAuditReportPage(client);

    expect(screen.getByLabelText("Loading audit summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading report body")).toBeInTheDocument();
  });

  it("renders a back navigation link to agent detail", async () => {
    const client = createClientMock();
    const reportClient = createReportClientMock({
      ok: true,
      report: reportFixture,
      reportJson: JSON.stringify(reportFixture, null, 2),
      sourceUrl: "https://gateway.example/ipfs/bafy-latest"
    });

    renderAuditReportPage(client, reportClient);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /audit report #2/i })).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /agent detail/i })).toHaveAttribute(
      "href",
      "/agent/1"
    );
  });

  it("renders resource usage section for verified reports", async () => {
    const client = createClientMock();
    const reportClient = createReportClientMock({
      ok: true,
      report: reportFixture,
      reportJson: JSON.stringify(reportFixture, null, 2),
      sourceUrl: "https://gateway.example/ipfs/bafy-latest"
    });

    renderAuditReportPage(client, reportClient);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /resource usage/i })).toBeInTheDocument();
    });

    expect(screen.getByText("220 mCPU")).toBeInTheDocument();
    expect(screen.getByText("512 MB")).toBeInTheDocument();
  });
});

async function computeSha256Hex(input: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
