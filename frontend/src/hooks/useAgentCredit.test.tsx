import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AgentAuditRegistryReadContract, AgentProfile, AuditRecord } from "../lib/agentAuditRegistryClient";
import { useAgentCredit } from "./useAgentCredit";

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

const latestAuditFixture: AuditRecord = {
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

function createClientMock(
  overrides: Partial<AgentAuditRegistryReadContract> = {}
): AgentAuditRegistryReadContract {
  return {
    getAgentProfile: vi.fn().mockResolvedValue(profileFixture),
    getLatestAuditReport: vi.fn().mockResolvedValue(latestAuditFixture),
    getAuditCount: vi.fn().mockResolvedValue(0n),
    getAuditReportByIndex: vi.fn(),
    ...overrides
  };
}

describe("useAgentCredit", () => {
  it("loads the agent profile and latest audit report", async () => {
    const client = createClientMock();

    const { result } = renderHook(() => useAgentCredit({ tokenId: 1n, client }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.profile).toEqual(profileFixture);
    expect(result.current.latestAudit).toEqual(latestAuditFixture);
    expect(result.current.errorCode).toBeNull();
    expect(client.getAgentProfile).toHaveBeenCalledWith(1n);
    expect(client.getLatestAuditReport).toHaveBeenCalledWith(1n);
  });

  it("keeps the profile but exposes a no-audit state when the latest report is missing", async () => {
    const client = createClientMock({
      getLatestAuditReport: vi.fn().mockRejectedValue(new Error("execution reverted: NO_AUDIT_RECORD"))
    });

    const { result } = renderHook(() => useAgentCredit({ tokenId: 1n, client }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.profile).toEqual(profileFixture);
    expect(result.current.latestAudit).toBeNull();
    expect(result.current.errorCode).toBe("NO_AUDIT_RECORD");
  });
});
