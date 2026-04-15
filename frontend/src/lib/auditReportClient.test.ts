import { describe, expect, it, vi } from "vitest";

import { createAuditReportClient, readAuditReportByCid } from "./auditReportClient";

const reportFixture = {
  schemaVersion: "audit-report.v1",
  agentName: "Sentinel",
  manifestHash: "manifest-hash-123",
  status: "completed",
  decisionType: "undetermined",
  healthcheckPassed: true,
  resourceMetrics: {
    cpuAvgMilli: 123,
    memoryPeakMb: 456
  },
  networkActivity: {
    requestedIps: ["203.0.113.10"],
    requestedHosts: ["api.example.com"],
    requestCount: 1
  },
  responseTrace: {
    answer: "safe result",
    actions: [{ type: "web_request", url: "https://api.example.com" }]
  },
  timestamps: {
    startedAt: "2026-03-30T09:00:00.000Z",
    finishedAt: "2026-03-30T09:00:01.000Z"
  }
} as const;

describe("readAuditReportByCid", () => {
  it("fetches report JSON from the gateway and verifies the report hash", async () => {
    const reportJson = JSON.stringify(reportFixture, null, 2);
    const expectedHash = await computeSha256Hex(reportJson);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(reportJson, {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const result = await readAuditReportByCid(
      {
        reportCID: "bafy-report",
        expectedReportHash: `0x${expectedHash}`
      },
      {
        fetchImpl,
        gatewayBaseUrl: "https://gateway.example/ipfs/"
      }
    );

    expect(result).toEqual({
      ok: true,
      report: reportFixture,
      reportJson,
      sourceUrl: "https://gateway.example/ipfs/bafy-report"
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://gateway.example/ipfs/bafy-report");
  });

  it("returns HASH_MISMATCH when the fetched JSON does not match the expected hash", async () => {
    const reportJson = JSON.stringify(reportFixture, null, 2);
    const fetchImpl = vi.fn().mockResolvedValue(new Response(reportJson, { status: 200 }));

    const result = await readAuditReportByCid(
      {
        reportCID: "bafy-report",
        expectedReportHash: "0xdeadbeef"
      },
      {
        fetchImpl
      }
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "HASH_MISMATCH",
      error: "Detailed audit report hash verification failed.",
      sourceUrl: "https://ipfs.io/ipfs/bafy-report"
    });
  });

  it("uses the configured gateway base url through createAuditReportClient", async () => {
    const reportJson = JSON.stringify(reportFixture, null, 2);
    const expectedHash = await computeSha256Hex(reportJson);
    const fetchImpl = vi.fn().mockResolvedValue(new Response(reportJson, { status: 200 }));
    const client = createAuditReportClient({
      gatewayBaseUrl: "https://gateway.example/custom/",
      fetchImpl
    });

    const result = await client.readReportByCid({
      reportCID: "bafy-report",
      expectedReportHash: expectedHash
    });

    expect(result).toMatchObject({
      ok: true,
      sourceUrl: "https://gateway.example/custom/bafy-report"
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://gateway.example/custom/bafy-report");
  });
});

async function computeSha256Hex(input: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
