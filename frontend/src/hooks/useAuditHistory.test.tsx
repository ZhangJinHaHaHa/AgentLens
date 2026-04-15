import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AgentAuditRegistryReadContract, AuditRecord } from "../lib/agentAuditRegistryClient";
import { useAuditHistory } from "./useAuditHistory";

function createAuditRecord(index: number): AuditRecord {
  return {
    auditId: BigInt(index + 1),
    timestamp: BigInt(1700000000 + index),
    auditScore: 80 + index,
    memoryPeakMb: 256 + index,
    cpuAvgMilli: 100 + index,
    requestIpCount: 1 + index,
    status: index % 2,
    manifestHash: `0x${String(index).padStart(64, "0")}`,
    reportHash: `0x${String(index + 1).padStart(64, "0")}`,
    reportCID: `bafy-${index}`,
    manifestUrl: `https://example.com/${index}.json`,
    appealRequested: false,
    appealApproved: false
  };
}

function createClientMock(auditCount: bigint): AgentAuditRegistryReadContract {
  return {
    getAgentProfile: vi.fn(),
    getLatestAuditReport: vi.fn(),
    getAuditCount: vi.fn().mockResolvedValue(auditCount),
    getAuditReportByIndex: vi.fn().mockImplementation(async (_tokenId: bigint, index: number) => {
      return createAuditRecord(index);
    })
  };
}

describe("useAuditHistory", () => {
  it("loads the newest ten records first and appends older pages without duplicates", async () => {
    const client = createClientMock(12n);

    const { result } = renderHook(() => useAuditHistory({ tokenId: 1n, client }));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    await waitFor(() => {
      expect(result.current.records).toHaveLength(10);
    });

    expect(result.current.records.map((record) => record.auditId)).toEqual([
      12n,
      11n,
      10n,
      9n,
      8n,
      7n,
      6n,
      5n,
      4n,
      3n
    ]);
    expect(client.getAuditCount).toHaveBeenCalledWith(1n);
    expect(client.getAuditReportByIndex).toHaveBeenNthCalledWith(1, 1n, 11);
    expect(client.getAuditReportByIndex).toHaveBeenNthCalledWith(10, 1n, 2);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.records).toHaveLength(12);
    });

    expect(result.current.records.map((record) => record.auditId)).toEqual([
      12n,
      11n,
      10n,
      9n,
      8n,
      7n,
      6n,
      5n,
      4n,
      3n,
      2n,
      1n
    ]);
    expect(client.getAuditReportByIndex).toHaveBeenNthCalledWith(11, 1n, 1);
    expect(client.getAuditReportByIndex).toHaveBeenNthCalledWith(12, 1n, 0);
    expect(result.current.hasMore).toBe(false);
  });

  it("stops at index zero and never requests out-of-range history entries", async () => {
    const client = createClientMock(3n);

    const { result } = renderHook(() => useAuditHistory({ tokenId: 1n, client }));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    await waitFor(() => {
      expect(result.current.records).toHaveLength(3);
    });

    expect(client.getAuditReportByIndex).toHaveBeenCalledTimes(3);
    expect(client.getAuditReportByIndex).toHaveBeenNthCalledWith(1, 1n, 2);
    expect(client.getAuditReportByIndex).toHaveBeenNthCalledWith(2, 1n, 1);
    expect(client.getAuditReportByIndex).toHaveBeenNthCalledWith(3, 1n, 0);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(client.getAuditReportByIndex).toHaveBeenCalledTimes(3);
    expect(result.current.hasMore).toBe(false);
  });
});
