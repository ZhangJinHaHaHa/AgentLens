import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

import { storePersistedAuditReport } from "../../src/report/storePersistedAuditReport";
import type { AuditReportArtifact } from "../../src/report/buildAuditReport";
import type { AuditRequestedEvent } from "../../src/listener/types";
import type { PersistedAuditReportArtifact } from "../../src/report/persistAuditReport";

const buildEvent = (): AuditRequestedEvent => ({
  eventKey: "0xabc/def:0",
  tokenId: 1n,
  developer: "dev",
  agentName: "agent",
  manifestUrl: "http://example.com/manifest",
  blockNumber: 123,
  transactionHash: "0xabc123"
});

const buildReportArtifact = (): AuditReportArtifact => ({
  reportHash: "abc123",
  report: {
    schemaVersion: "audit-report.v1",
    agentName: "agent",
    manifestHash: "manifest",
    status: "completed",
    decisionType: "undetermined",
    healthcheckPassed: true,
    resourceMetrics: { cpuAvgMilli: 1, memoryPeakMb: 1 },
    networkActivity: { requestedIps: [], requestedHosts: [], requestCount: 0 },
    responseTrace: { answer: "ok", actions: [] },
    timestamps: { startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() }
  },
  reportJson: "{}"
});

async function buildPersistedReport(
  content: string
): Promise<PersistedAuditReportArtifact & { baseDir: string }> {
  const baseDir = await mkdtemp(`${tmpdir()}${sep}audit-reports-`);
  const reportFileName = "1-0xabc-0-abc123.json";
  const reportFilePath = join(baseDir, reportFileName);
  await writeFile(reportFilePath, content, "utf8");
  return { reportFileName, reportFilePath, baseDir };
}

test("storePersistedAuditReport uses persisted bytes for both COS and IPFS", async () => {
  const reportPersistence = await buildPersistedReport("from-disk");
  const captured: {
    cosBody?: Buffer;
    cosObjectKey?: string;
    cosContentType?: string;
    ipfsBody?: Buffer;
    ipfsFileName?: string;
    sequence: string[];
  } = {
    sequence: []
  };

  try {
    const result = await storePersistedAuditReport(
      {
        event: buildEvent(),
        reportArtifact: { ...buildReportArtifact(), reportJson: "from-json" },
        reportPersistence
      },
      {
        putObject: async ({
          body,
          objectKey,
          contentType
        }: {
          body: Buffer;
          objectKey: string;
          contentType: string;
        }) => {
          captured.cosBody = body;
          captured.cosObjectKey = objectKey;
          captured.cosContentType = contentType;
          captured.sequence.push("cos");
        },
        addToIpfs: async ({ body, fileName }: { body: Buffer; fileName: string }) => {
          captured.ipfsBody = body;
          captured.ipfsFileName = fileName;
          captured.sequence.push("ipfs");
          return { cid: "bafybeigdyrzt4example" };
        }
      }
    );

    assert.deepEqual(result, {
      reportCid: "bafybeigdyrzt4example",
      cosObjectKey: "reports/1/0xabc-def-0/abc123.json"
    });
    assert.ok(captured.cosBody);
    assert.ok(captured.ipfsBody);
    assert.equal(captured.cosObjectKey, "reports/1/0xabc-def-0/abc123.json");
    assert.equal(captured.cosContentType, "application/json");
    assert.equal(captured.ipfsFileName, "1-0xabc-def-0-abc123.json");
    assert.strictEqual(captured.cosBody, captured.ipfsBody);
    assert.equal(captured.cosBody.equals(Buffer.from("from-disk")), true);
    assert.deepEqual(captured.sequence, ["cos", "ipfs"]);
  } finally {
    await rm(reportPersistence.baseDir, { force: true, recursive: true });
  }
});

test("storePersistedAuditReport honors a custom COS key prefix", async () => {
  const reportPersistence = await buildPersistedReport("from-disk");
  const captured: { cosObjectKey?: string } = {};

  try {
    const result = await storePersistedAuditReport(
      {
        event: buildEvent(),
        reportArtifact: buildReportArtifact(),
        reportPersistence,
        cosKeyPrefix: "custom-prefix"
      },
      {
        putObject: async ({ objectKey }: { objectKey: string }) => {
          captured.cosObjectKey = objectKey;
        },
        addToIpfs: async () => ({ cid: "bafybeigdyrzt4example" })
      }
    );

    assert.equal(result.cosObjectKey, "custom-prefix/1/0xabc-def-0/abc123.json");
    assert.equal(captured.cosObjectKey, "custom-prefix/1/0xabc-def-0/abc123.json");
  } finally {
    await rm(reportPersistence.baseDir, { force: true, recursive: true });
  }
});

test("storePersistedAuditReport rejects when IPFS upload fails after COS", async () => {
  const reportPersistence = await buildPersistedReport("from-disk");
  let cosUploads = 0;

  try {
    await assert.rejects(
      () =>
        storePersistedAuditReport(
          {
            event: buildEvent(),
            reportArtifact: buildReportArtifact(),
            reportPersistence
          },
          {
            putObject: async () => {
              cosUploads += 1;
            },
            addToIpfs: async () => {
              throw new Error("ipfs down");
            }
          }
        ),
      /ipfs down/
    );

    assert.equal(cosUploads, 1);
  } finally {
    await rm(reportPersistence.baseDir, { force: true, recursive: true });
  }
});

test("storePersistedAuditReport short-circuits when COS upload fails", async () => {
  const reportPersistence = await buildPersistedReport("from-disk");
  let ipfsUploads = 0;

  try {
    await assert.rejects(
      () =>
        storePersistedAuditReport(
          {
            event: buildEvent(),
            reportArtifact: buildReportArtifact(),
            reportPersistence
          },
          {
            putObject: async () => {
              throw new Error("cos down");
            },
            addToIpfs: async () => {
              ipfsUploads += 1;
              return { cid: "bafybeigdyrzt4example" };
            }
          }
        ),
      /cos down/
    );

    assert.equal(ipfsUploads, 0);
  } finally {
    await rm(reportPersistence.baseDir, { force: true, recursive: true });
  }
});
