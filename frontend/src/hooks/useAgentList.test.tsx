import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AgentAuditRegistryReadContract, AgentProfile, AuditRecord } from "../lib/agentAuditRegistryClient";
import { useAgentList } from "./useAgentList";

function createProfile(tokenId: number, name: string): AgentProfile {
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

function createAuditRecord(): AuditRecord {
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

function createClientMock(agentCount: number): AgentAuditRegistryReadContract {
  return {
    getAgentProfile: vi.fn().mockImplementation(async (tokenId: bigint) => {
      const id = Number(tokenId);
      if (id <= agentCount) {
        return createProfile(id, `Agent-${id}`);
      }
      throw new Error("execution reverted: TOKEN_NOT_FOUND");
    }),
    getLatestAuditReport: vi.fn().mockImplementation(async (tokenId: bigint) => {
      const id = Number(tokenId);
      if (id <= agentCount) {
        return createAuditRecord();
      }
      throw new Error("execution reverted: TOKEN_NOT_FOUND");
    }),
    getAuditCount: vi.fn().mockResolvedValue(2n),
    getAuditReportByIndex: vi.fn().mockResolvedValue(createAuditRecord())
  };
}

describe("useAgentList", () => {
  it("scans and discovers registered agents", async () => {
    const client = createClientMock(3);

    const { result } = renderHook(() => useAgentList({ client }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.agents).toHaveLength(3);
    expect(result.current.agents[0].agentName).toBe("Agent-1");
    expect(result.current.agents[1].agentName).toBe("Agent-2");
    expect(result.current.agents[2].agentName).toBe("Agent-3");
  });

  it("stops scanning after consecutive not-found responses", async () => {
    const client = createClientMock(2);

    const { result } = renderHook(() => useAgentList({ client }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.agents).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);
  });

  it("includes agents without audit records", async () => {
    const client = createClientMock(1);
    (client.getLatestAuditReport as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("execution reverted: NO_AUDIT_RECORD")
    );

    const { result } = renderHook(() => useAgentList({ client }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.agents).toHaveLength(1);
    expect(result.current.agents[0].latestStatus).toBeNull();
    expect(result.current.agents[0].latestScore).toBeNull();
  });

  it("loads more agents when loadMore is called", async () => {
    const client = createClientMock(15);

    const { result } = renderHook(() => useAgentList({ client }));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.agents.length).toBe(10);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.agents.length).toBe(15);
    });
  });

  it("reports error status when scan fails with non-TOKEN_NOT_FOUND error", async () => {
    const client: AgentAuditRegistryReadContract = {
      getAgentProfile: vi.fn().mockRejectedValue(new Error("socket hang up")),
      getLatestAuditReport: vi.fn().mockRejectedValue(new Error("socket hang up")),
      getAuditCount: vi.fn().mockRejectedValue(new Error("socket hang up")),
      getAuditReportByIndex: vi.fn().mockRejectedValue(new Error("socket hang up"))
    };

    const { result } = renderHook(() => useAgentList({ client }));

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.errorMessage).toBe("socket hang up");
  });
});
