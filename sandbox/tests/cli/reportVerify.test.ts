import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  parseReportVerifyCliArgs,
  runReportVerifyCli
} from "../../src/cli/reportVerify";
import { persistAuditReport } from "../../src/report/persistAuditReport";
import { computeAuditReportHash } from "../../src/report/buildAuditReport";
import type {
  ReadPersistedAuditReportOptions,
  ReadPersistedAuditReportResult
} from "../../src/report/readPersistedAuditReport";
import type { AuditRequestedEvent } from "../../src/listener/types";
import type { AuditReportArtifact } from "../../src/report/buildAuditReport";

const buildEvent = (overrides: Partial<AuditRequestedEvent> = {}): AuditRequestedEvent => ({
  eventKey: "0xabc:0",
  tokenId: 1n,
  developer: "dev",
  agentName: "agent",
  manifestUrl: "https://example.com/manifest.json",
  blockNumber: 123,
  transactionHash: "0xabc",
  ...overrides
});

const buildReportArtifact = (reportJson = '{"ok":true}'): AuditReportArtifact => ({
  reportHash: computeAuditReportHash(reportJson),
  report: {
    schemaVersion: "audit-report.v1",
    agentName: "agent",
    manifestHash: "f".repeat(64),
    status: "completed",
    decisionType: "undetermined",
    healthcheckPassed: true,
    resourceMetrics: {
      cpuAvgMilli: 12,
      memoryPeakMb: 64
    },
    networkActivity: {
      requestedIps: [],
      requestedHosts: [],
      requestCount: 0
    },
    responseTrace: {
      answer: "ok",
      actions: []
    },
    timestamps: {
      startedAt: "2026-03-29T00:00:00.000Z",
      finishedAt: "2026-03-29T00:01:00.000Z"
    }
  },
  reportJson
});

test("parseReportVerifyCliArgs parses --event-key and optional --state-dir", () => {
  assert.deepEqual(
    parseReportVerifyCliArgs(["--event-key", "0xabc:12", "--state-dir", "/tmp/listener-state"]),
    {
      eventKey: "0xabc:12",
      stateDir: "/tmp/listener-state"
    }
  );
});

test("runReportVerifyCli returns invalid_event_key JSON and non-zero exit for malformed eventKey", async () => {
  const writes: string[] = [];
  const exitCode = await runReportVerifyCli(["--event-key", "bad-key"], process.env, {
    writeStdout: (line: string) => {
      writes.push(line);
    }
  });

  assert.equal(exitCode, 1);
  assert.equal(writes.length, 1);
  assert.deepEqual(JSON.parse(writes[0] ?? ""), {
    status: "invalid_event_key",
    eventKey: "bad-key",
    message: "eventKey must match the current <transactionHash>:<logIndex> format"
  });
  assert.equal(writes[0]?.endsWith("\n"), true);
});

test("runReportVerifyCli uses default listener state-dir helper when --state-dir omitted", async () => {
  const cwd = process.cwd();
  const tempCwd = await mkdtemp(path.join(tmpdir(), "sandbox-report-verify-default-cwd-"));
  const writes: string[] = [];
  const observed: { baseDir?: string } = {};
  let expectedBaseDir: string | undefined;

  try {
    process.chdir(tempCwd);
    expectedBaseDir = path.join(process.cwd(), ".runtime", "listener", "reports");
    const exitCode = await runReportVerifyCli(["--event-key", "0xabc:0"], {}, {
      writeStdout: (line: string) => {
        writes.push(line);
      },
      readPersistedAuditReport: async (
        options: ReadPersistedAuditReportOptions
      ): Promise<ReadPersistedAuditReportResult> => {
        observed.baseDir = options.baseDir;
        return { status: "not_found", eventKey: options.eventKey };
      }
    });
    assert.equal(exitCode, 1);
  } finally {
    process.chdir(cwd);
  }

  assert.equal(observed.baseDir, expectedBaseDir);
  assert.equal(writes.length, 1);
});

test("runReportVerifyCli honors AUDIT_LISTENER_STATE_DIR when --state-dir omitted", async () => {
  const writes: string[] = [];
  const observed: { baseDir?: string } = {};
  const stateDir = path.join(tmpdir(), "sandbox-report-verify-env-state");
  const exitCode = await runReportVerifyCli(
    ["--event-key", "0xabc:0"],
    { AUDIT_LISTENER_STATE_DIR: stateDir },
    {
      writeStdout: (line: string) => {
        writes.push(line);
      },
      readPersistedAuditReport: async (
        options: ReadPersistedAuditReportOptions
      ): Promise<ReadPersistedAuditReportResult> => {
        observed.baseDir = options.baseDir;
        return { status: "not_found", eventKey: options.eventKey };
      }
    }
  );

  assert.equal(exitCode, 1);
  assert.equal(observed.baseDir, path.join(stateDir, "reports"));
  assert.equal(writes.length, 1);
});

test("runReportVerifyCli lets --state-dir override AUDIT_LISTENER_STATE_DIR", async () => {
  const writes: string[] = [];
  const observed: { baseDir?: string } = {};
  const envStateDir = path.join(tmpdir(), "sandbox-report-verify-env-state");
  const cliStateDir = path.join(tmpdir(), "sandbox-report-verify-cli-state");
  const exitCode = await runReportVerifyCli(
    ["--event-key", "0xabc:0", "--state-dir", cliStateDir],
    { AUDIT_LISTENER_STATE_DIR: envStateDir },
    {
      writeStdout: (line: string) => {
        writes.push(line);
      },
      readPersistedAuditReport: async (
        options: ReadPersistedAuditReportOptions
      ): Promise<ReadPersistedAuditReportResult> => {
        observed.baseDir = options.baseDir;
        return { status: "not_found", eventKey: options.eventKey };
      }
    }
  );

  assert.equal(exitCode, 1);
  assert.equal(observed.baseDir, path.join(cliStateDir, "reports"));
  assert.equal(writes.length, 1);
});

test("runReportVerifyCli prints verified JSON and returns exit code 0", async () => {
  const reportsDir = await mkdtemp(path.join(tmpdir(), "sandbox-report-verify-ok-"));
  const event = buildEvent();
  const artifact = buildReportArtifact('{"ok":true}');
  const persisted = await persistAuditReport({
    event,
    reportArtifact: artifact,
    baseDir: reportsDir
  });
  const writes: string[] = [];

  const exitCode = await runReportVerifyCli(
    ["--event-key", event.eventKey, "--state-dir", path.dirname(reportsDir)],
    process.env,
    {
      writeStdout: (line: string) => {
        writes.push(line);
      },
      readPersistedAuditReport: async (
        options: ReadPersistedAuditReportOptions
      ): Promise<ReadPersistedAuditReportResult> => {
        return {
          status: "verified",
          eventKey: options.eventKey,
          reportFilePath: persisted.reportFilePath,
          reportHash: artifact.reportHash
        };
      }
    }
  );

  assert.equal(exitCode, 0);
  assert.equal(writes.length, 1);
  assert.equal(
    writes[0],
    `${JSON.stringify({
      status: "verified",
      eventKey: event.eventKey,
      reportFilePath: persisted.reportFilePath,
      reportHash: artifact.reportHash
    })}\n`
  );
});

test("runReportVerifyCli returns non-zero exit for not_found/hash_mismatch/conflict", async () => {
  const statuses: ReadPersistedAuditReportResult[] = [
    { status: "not_found", eventKey: "0xabc:1" },
    {
      status: "hash_mismatch",
      eventKey: "0xabc:2",
      reportFilePath: "/tmp/report.json",
      expectedReportHash: "a".repeat(64),
      actualReportHash: "b".repeat(64)
    },
    {
      status: "conflict",
      eventKey: "0xabc:3",
      matches: ["/tmp/a.json", "/tmp/b.json"]
    }
  ];

  for (const result of statuses) {
    const writes: string[] = [];
    const exitCode = await runReportVerifyCli(["--event-key", result.eventKey], process.env, {
      writeStdout: (line: string) => {
        writes.push(line);
      },
      readPersistedAuditReport: async () => result
    });

    assert.equal(exitCode, 1);
    assert.equal(writes.length, 1);
    assert.equal(writes[0], `${JSON.stringify(result)}\n`);
  }
});

test("runReportVerifyCli can surface hash_mismatch from persisted report bytes", async () => {
  const stateDir = await mkdtemp(path.join(tmpdir(), "sandbox-report-verify-mismatch-state-"));
  const reportsDir = path.join(stateDir, "reports");
  const event = buildEvent({ eventKey: "0xabc:77" });
  const persisted = await persistAuditReport({
    event,
    reportArtifact: buildReportArtifact('{"ok":true}'),
    baseDir: reportsDir
  });
  await writeFile(persisted.reportFilePath, '{"ok":false}', "utf8");
  const writes: string[] = [];

  const exitCode = await runReportVerifyCli(
    ["--event-key", event.eventKey, "--state-dir", stateDir],
    process.env,
    {
      writeStdout: (line: string) => {
        writes.push(line);
      }
    }
  );

  assert.equal(exitCode, 1);
  assert.equal(writes.length, 1);
  assert.equal((JSON.parse(writes[0] ?? "") as { status: string }).status, "hash_mismatch");
  assert.equal(writes[0]?.endsWith("\n"), true);
});
