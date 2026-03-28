import { describe, expect, it, vi } from "vitest";

import artifact from "../../../contracts/artifacts/AgentAuditRegistry.json";
import { createAgentAuditRegistryClient } from "./agentAuditRegistryClient";

describe("createAgentAuditRegistryClient", () => {
  it("loads the canonical AgentAuditRegistry ABI from the repo artifact", () => {
    expect(artifact.contractName).toBe("AgentAuditRegistry");
    expect(
      artifact.abi.some((entry) => entry.type === "function" && entry.name === "getAgentProfile")
    ).toBe(true);
  });

  it("calls getAgentProfile, getLatestAuditReport, getAuditCount, and getAuditReportByIndex", async () => {
    const getAgentProfile = vi.fn().mockResolvedValue({
      tokenId: 1n,
      totalBond: 1000000000000000000n,
      blacklisted: false
    });
    const getLatestAuditReport = vi.fn().mockResolvedValue({ auditId: 2n });
    const getAuditCount = vi.fn().mockResolvedValue(4n);
    const getAuditReportByIndex = vi.fn().mockResolvedValue({ auditId: 1n });

    const client = createAgentAuditRegistryClient(
      {
        rpcUrl: "https://rpc.edge.local",
        registryAddress: "0x1111111111111111111111111111111111111111",
        chainId: 31337
      },
      {
        contract: {
          getAgentProfile,
          getLatestAuditReport,
          getAuditCount,
          getAuditReportByIndex
        }
      }
    );

    await expect(client.getAgentProfile(1n)).resolves.toEqual({
      tokenId: 1n,
      totalBond: 1000000000000000000n,
      blacklisted: false
    });
    await expect(client.getLatestAuditReport(1n)).resolves.toEqual({ auditId: 2n });
    await expect(client.getAuditCount(1n)).resolves.toBe(4n);
    await expect(client.getAuditReportByIndex(1n, 0)).resolves.toEqual({ auditId: 1n });

    expect(getAgentProfile).toHaveBeenCalledWith(1n);
    expect(getLatestAuditReport).toHaveBeenCalledWith(1n);
    expect(getAuditCount).toHaveBeenCalledWith(1n);
    expect(getAuditReportByIndex).toHaveBeenCalledWith(1n, 0);
  });
});
