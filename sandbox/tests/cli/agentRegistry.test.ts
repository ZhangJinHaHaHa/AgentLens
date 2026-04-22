import test from "node:test";
import assert from "node:assert/strict";

import {
  parseAgentRegistryGetReportArgs,
  parseAgentRegistryHistoryArgs,
  parseAgentRegistrySearchArgs,
  parseAgentRegistryVerifyArgs,
  runAgentRegistryCli,
  runAgentRegistryGetReportCli,
  runAgentRegistryHistoryCli,
  runAgentRegistrySearchCli,
  runAgentRegistryVerifyCli
} from "../../src/cli/agentRegistry";
import type { AgentProfileOnChain } from "../../src/listener/readAgentProfile";
import type { LatestAuditReport } from "../../src/listener/readLatestAuditReport";
import type { AuditReportByIndex } from "../../src/listener/readAuditReportByIndex";

const config = {
  rpcUrl: "http://localhost:8545",
  contractAddress: "0x1111111111111111111111111111111111111111",
  pollIntervalMs: 5000
};

function buildProfile(overrides: Partial<AgentProfileOnChain> = {}): AgentProfileOnChain {
  return {
    developer: "0x000000000000000000000000000000000000dEaD",
    agentName: "risk-agent",
    tokenId: 1n,
    totalBond: 1000n,
    blacklisted: false,
    createdAt: 1710000000,
    lastAuditAt: 1710000100,
    auditCount: 1,
    ...overrides
  };
}

function buildLatestAuditReport(overrides: Partial<LatestAuditReport> = {}): LatestAuditReport {
  return {
    auditId: 1,
    timestamp: 1710000100,
    auditScore: 92,
    memoryPeakMb: 64,
    cpuAvgMilli: 120,
    requestIpCount: 1,
    status: 2,
    manifestHash: `0x${"a".repeat(64)}`,
    reportHash: `0x${"b".repeat(64)}`,
    evidenceRoot: `0x${"c".repeat(64)}`,
    attestationHash: `0x${"d".repeat(64)}`,
    evidenceCID: "bafy-evidence",
    reportCID: "bafy-report",
    manifestUrl: "https://example.com/manifest.json",
    appealRequested: false,
    appealApproved: false,
    ...overrides
  };
}

function buildAuditReportByIndex(
  overrides: Partial<AuditReportByIndex> = {}
): AuditReportByIndex {
  return {
    auditId: 1,
    timestamp: 1710000100,
    auditScore: 92,
    memoryPeakMb: 64,
    cpuAvgMilli: 120,
    requestIpCount: 1,
    status: 2,
    manifestHash: `0x${"a".repeat(64)}`,
    reportHash: `0x${"b".repeat(64)}`,
    evidenceRoot: `0x${"c".repeat(64)}`,
    attestationHash: `0x${"d".repeat(64)}`,
    evidenceCID: "bafy-evidence",
    reportCID: "bafy-report",
    manifestUrl: "https://example.com/manifest.json",
    appealRequested: false,
    appealApproved: false,
    ...overrides
  };
}

test("parseAgentRegistryGetReportArgs parses --token-id", () => {
  assert.deepEqual(parseAgentRegistryGetReportArgs(["--token-id", "12"]), {
    tokenId: 12n
  });
});

test("parseAgentRegistryGetReportArgs parses optional --audit-id", () => {
  assert.deepEqual(parseAgentRegistryGetReportArgs(["--token-id", "12", "--audit-id", "3"]), {
    tokenId: 12n,
    auditId: 3
  });
});

test("parseAgentRegistryHistoryArgs parses defaults and paging args", () => {
  assert.deepEqual(
    parseAgentRegistryHistoryArgs(["--token-id", "12", "--offset", "2", "--limit", "5"]),
    {
      tokenId: 12n,
      offset: 2,
      limit: 5
    }
  );

  assert.deepEqual(parseAgentRegistryHistoryArgs(["--token-id", "12"]), {
    tokenId: 12n,
    offset: 0,
    limit: 10
  });
});

test("parseAgentRegistrySearchArgs returns defaults and optional filters", () => {
  assert.deepEqual(
    parseAgentRegistrySearchArgs([
      "--start-token-id",
      "3",
      "--batch-size",
      "8",
      "--max-consecutive-not-found",
      "2",
      "--agent-name-contains",
      "risk",
      "--status",
      "2",
      "--min-score",
      "80"
    ]),
    {
      startTokenId: 3,
      batchSize: 8,
      maxConsecutiveNotFound: 2,
      agentNameContains: "risk",
      status: 2,
      minScore: 80
    }
  );

  assert.deepEqual(parseAgentRegistrySearchArgs([]), {
    startTokenId: 1,
    batchSize: 10,
    maxConsecutiveNotFound: 5
  });
});

test("parseAgentRegistryVerifyArgs parses verify kind and forwarded args", () => {
  assert.deepEqual(parseAgentRegistryVerifyArgs(["report", "--event-key", "0xabc:0"]), {
    kind: "report",
    forwardedArgv: ["--event-key", "0xabc:0"]
  });
});

test("runAgentRegistryGetReportCli prints profile and latest audit summary", async () => {
  const writes: string[] = [];
  const exitCode = await runAgentRegistryGetReportCli(["--token-id", "1"], process.env, {
    readConfig: () => config,
    writeStdout: (line: string) => {
      writes.push(line);
    },
    readAgentProfile: async () => buildProfile(),
    readLatestAuditReport: async () => buildLatestAuditReport()
  });

  assert.equal(exitCode, 0);
  assert.equal(writes.length, 1);
  assert.deepEqual(JSON.parse(writes[0] ?? ""), {
    status: "ok",
    tokenId: "1",
    profile: {
      developer: "0x000000000000000000000000000000000000dEaD",
      agentName: "risk-agent",
      tokenId: "1",
      totalBond: "1000",
      blacklisted: false,
      createdAt: 1710000000,
      lastAuditAt: 1710000100,
      auditCount: 1
    },
    latestAuditReport: {
      auditId: 1,
      timestamp: 1710000100,
      auditScore: 92,
      memoryPeakMb: 64,
      cpuAvgMilli: 120,
      requestIpCount: 1,
      status: 2,
      manifestHash: `0x${"a".repeat(64)}`,
      reportHash: `0x${"b".repeat(64)}`,
      evidenceRoot: `0x${"c".repeat(64)}`,
      attestationHash: `0x${"d".repeat(64)}`,
      evidenceCID: "bafy-evidence",
      reportCID: "bafy-report",
      manifestUrl: "https://example.com/manifest.json",
      appealRequested: false,
      appealApproved: false
    }
  });
});

test("runAgentRegistryGetReportCli returns not_found JSON for missing token", async () => {
  const writes: string[] = [];
  const exitCode = await runAgentRegistryGetReportCli(["--token-id", "7"], process.env, {
    readConfig: () => config,
    writeStdout: (line: string) => {
      writes.push(line);
    },
    readAgentProfile: async () => {
      throw new Error("execution reverted: TOKEN_NOT_FOUND");
    }
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(JSON.parse(writes[0] ?? ""), {
    status: "not_found",
    tokenId: "7"
  });
});

test("runAgentRegistryGetReportCli tolerates missing latest audit record", async () => {
  const writes: string[] = [];
  const exitCode = await runAgentRegistryGetReportCli(["--token-id", "1"], process.env, {
    readConfig: () => config,
    writeStdout: (line: string) => {
      writes.push(line);
    },
    readAgentProfile: async () => buildProfile(),
    readLatestAuditReport: async () => {
      throw new Error("execution reverted: NO_AUDIT_RECORD");
    }
  });

  assert.equal(exitCode, 0);
  assert.equal(JSON.parse(writes[0] ?? "").latestAuditReport, null);
});

test("runAgentRegistrySearchCli scans sequential token ids and applies filters", async () => {
  const writes: string[] = [];
  const exitCode = await runAgentRegistrySearchCli(
    [
      "--start-token-id",
      "1",
      "--batch-size",
      "5",
      "--agent-name-contains",
      "risk",
      "--status",
      "2",
      "--min-score",
      "80"
    ],
    process.env,
    {
      readConfig: () => config,
      writeStdout: (line: string) => {
        writes.push(line);
      },
      readAgentProfile: async ({ tokenId }) => {
        if (tokenId === 1n) {
          return buildProfile({ tokenId: 1n, agentName: "risk-alpha", auditCount: 2 });
        }

        if (tokenId === 2n) {
          return buildProfile({ tokenId: 2n, agentName: "other-beta" });
        }

        if (tokenId === 3n) {
          throw new Error("execution reverted: TOKEN_NOT_FOUND");
        }

        if (tokenId === 4n) {
          return buildProfile({ tokenId: 4n, agentName: "risk-gamma" });
        }

        if (tokenId === 5n) {
          throw new Error("execution reverted: TOKEN_NOT_FOUND");
        }

        throw new Error(`unexpected token ${tokenId.toString()}`);
      },
      readLatestAuditReport: async ({ tokenId }) => {
        if (tokenId === 1n) {
          return buildLatestAuditReport({ auditScore: 90, status: 2 });
        }

        if (tokenId === 2n) {
          return buildLatestAuditReport({ auditScore: 91, status: 2 });
        }

        if (tokenId === 4n) {
          return buildLatestAuditReport({ auditScore: 70, status: 2 });
        }

        throw new Error(`unexpected latest audit token ${tokenId.toString()}`);
      }
    }
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(JSON.parse(writes[0] ?? ""), {
    status: "ok",
    filters: {
      startTokenId: 1,
      batchSize: 5,
      maxConsecutiveNotFound: 5,
      agentNameContains: "risk",
      status: 2,
      minScore: 80
    },
    agents: [
      {
        tokenId: "1",
        agentName: "risk-alpha",
        developer: "0x000000000000000000000000000000000000dEaD",
        totalBond: "1000",
        blacklisted: false,
        auditCount: 2,
        latestStatus: 2,
        latestScore: 90
      }
    ],
    nextScanTokenId: "6",
    consecutiveNotFound: 1,
    hasMore: true
  });
});

test("runAgentRegistrySearchCli stops after consecutive missing tokens", async () => {
  const writes: string[] = [];
  const exitCode = await runAgentRegistrySearchCli(
    ["--batch-size", "10", "--max-consecutive-not-found", "2"],
    process.env,
    {
      readConfig: () => config,
      writeStdout: (line: string) => {
        writes.push(line);
      },
      readAgentProfile: async ({ tokenId }) => {
        if (tokenId === 1n) {
          return buildProfile({ tokenId: 1n });
        }

        throw new Error("execution reverted: TOKEN_NOT_FOUND");
      },
      readLatestAuditReport: async () => {
        throw new Error("execution reverted: NO_AUDIT_RECORD");
      }
    }
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(JSON.parse(writes[0] ?? ""), {
    status: "ok",
    filters: {
      startTokenId: 1,
      batchSize: 10,
      maxConsecutiveNotFound: 2,
      agentNameContains: null,
      status: null,
      minScore: null
    },
    agents: [
      {
        tokenId: "1",
        agentName: "risk-agent",
        developer: "0x000000000000000000000000000000000000dEaD",
        totalBond: "1000",
        blacklisted: false,
        auditCount: 1,
        latestStatus: null,
        latestScore: null
      }
    ],
    nextScanTokenId: "4",
    consecutiveNotFound: 2,
    hasMore: false
  });
});

test("runAgentRegistryVerifyCli forwards report kind to report verify CLI", async () => {
  const calls: Array<{ argv: string[]; envKeys: string[] }> = [];
  const exitCode = await runAgentRegistryVerifyCli(
    ["report", "--event-key", "0xabc:0"],
    { AUDIT_LISTENER_STATE_DIR: "/tmp/listener-state" },
    {
      runReportVerifyCli: async (argv, env) => {
        calls.push({ argv, envKeys: Object.keys(env).sort() });
        return 0;
      }
    }
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [
    {
      argv: ["--event-key", "0xabc:0"],
      envKeys: ["AUDIT_LISTENER_STATE_DIR"]
    }
  ]);
});

test("runAgentRegistryVerifyCli forwards evidence kind to evidence verify CLI", async () => {
  const calls: Array<{ argv: string[]; envKeys: string[] }> = [];
  const exitCode = await runAgentRegistryVerifyCli(
    ["evidence", "--event-key", "0xabc:0"],
    { AUDIT_LISTENER_STATE_DIR: "/tmp/listener-state" },
    {
      runEvidenceVerifyCli: async (argv, env) => {
        calls.push({ argv, envKeys: Object.keys(env).sort() });
        return 0;
      }
    }
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [
    {
      argv: ["--event-key", "0xabc:0"],
      envKeys: ["AUDIT_LISTENER_STATE_DIR"]
    }
  ]);
});

test("runAgentRegistryVerifyCli forwards attestation kind to attestation verify CLI", async () => {
  const calls: Array<{ argv: string[]; envKeys: string[] }> = [];
  const exitCode = await runAgentRegistryVerifyCli(
    ["attestation", "--event-key", "0xabc:0"],
    { AUDIT_LISTENER_STATE_DIR: "/tmp/listener-state" },
    {
      runAttestationVerifyCli: async (argv, env) => {
        calls.push({ argv, envKeys: Object.keys(env).sort() });
        return 0;
      }
    }
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [
    {
      argv: ["--event-key", "0xabc:0"],
      envKeys: ["AUDIT_LISTENER_STATE_DIR"]
    }
  ]);
});

test("runAgentRegistryCli dispatches to search subcommand", async () => {
  const writes: string[] = [];
  const exitCode = await runAgentRegistryCli(["search", "--batch-size", "1"], process.env, {
    readConfig: () => config,
    writeStdout: (line: string) => {
      writes.push(line);
    },
    readAgentProfile: async () => buildProfile(),
    readLatestAuditReport: async () => buildLatestAuditReport()
  });

  assert.equal(exitCode, 0);
  assert.equal(JSON.parse(writes[0] ?? "").status, "ok");
});


test("runAgentRegistryGetReportCli returns historical audit by --audit-id", async () => {
  const writes: string[] = [];
  const readIndexes: number[] = [];
  const exitCode = await runAgentRegistryGetReportCli(
    ["--token-id", "1", "--audit-id", "7"],
    process.env,
    {
      readConfig: () => config,
      writeStdout: (line: string) => {
        writes.push(line);
      },
      readAgentProfile: async () => buildProfile({ auditCount: 3 }),
      readAuditReportByIndex: async ({ index }) => {
        readIndexes.push(index);

        if (index === 0) {
          return buildAuditReportByIndex({ auditId: 5, auditScore: 80, reportCID: "bafy-report-5" });
        }

        if (index === 1) {
          return buildAuditReportByIndex({ auditId: 7, auditScore: 95, reportCID: "bafy-report-7" });
        }

        if (index === 2) {
          return buildAuditReportByIndex({ auditId: 9, auditScore: 88, reportCID: "bafy-report-9" });
        }

        throw new Error(`unexpected index ${index}`);
      }
    }
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(readIndexes, [0, 1]);
  assert.deepEqual(JSON.parse(writes[0] ?? ""), {
    status: "ok",
    tokenId: "1",
    auditId: 7,
    profile: {
      developer: "0x000000000000000000000000000000000000dEaD",
      agentName: "risk-agent",
      tokenId: "1",
      totalBond: "1000",
      blacklisted: false,
      createdAt: 1710000000,
      lastAuditAt: 1710000100,
      auditCount: 3
    },
    auditReport: {
      auditId: 7,
      timestamp: 1710000100,
      auditScore: 95,
      memoryPeakMb: 64,
      cpuAvgMilli: 120,
      requestIpCount: 1,
      status: 2,
      manifestHash: `0x${"a".repeat(64)}`,
      reportHash: `0x${"b".repeat(64)}`,
      evidenceRoot: `0x${"c".repeat(64)}`,
      attestationHash: `0x${"d".repeat(64)}`,
      evidenceCID: "bafy-evidence",
      reportCID: "bafy-report-7",
      manifestUrl: "https://example.com/manifest.json",
      appealRequested: false,
      appealApproved: false
    }
  });
});

test("runAgentRegistryGetReportCli returns audit_not_found when audit id is absent", async () => {
  const writes: string[] = [];
  const exitCode = await runAgentRegistryGetReportCli(
    ["--token-id", "1", "--audit-id", "99"],
    process.env,
    {
      readConfig: () => config,
      writeStdout: (line: string) => {
        writes.push(line);
      },
      readAgentProfile: async () => buildProfile({ auditCount: 2 }),
      readAuditReportByIndex: async ({ index }) =>
        buildAuditReportByIndex({ auditId: index === 0 ? 5 : 7, reportCID: `bafy-report-${index}` })
    }
  );

  assert.equal(exitCode, 1);
  assert.deepEqual(JSON.parse(writes[0] ?? ""), {
    status: "audit_not_found",
    tokenId: "1",
    auditId: 99,
    profile: {
      developer: "0x000000000000000000000000000000000000dEaD",
      agentName: "risk-agent",
      tokenId: "1",
      totalBond: "1000",
      blacklisted: false,
      createdAt: 1710000000,
      lastAuditAt: 1710000100,
      auditCount: 2
    }
  });
});

test("runAgentRegistryHistoryCli returns latest-first paged audits", async () => {
  const writes: string[] = [];
  const readIndexes: number[] = [];
  const exitCode = await runAgentRegistryHistoryCli(
    ["--token-id", "1", "--offset", "1", "--limit", "2"],
    process.env,
    {
      readConfig: () => config,
      writeStdout: (line: string) => {
        writes.push(line);
      },
      readAgentProfile: async () => buildProfile({ auditCount: 4 }),
      readAuditReportByIndex: async ({ index }) => {
        readIndexes.push(index);

        if (index === 2) {
          return buildAuditReportByIndex({ auditId: 12, auditScore: 90, reportCID: "bafy-report-12" });
        }

        if (index === 1) {
          return buildAuditReportByIndex({ auditId: 11, auditScore: 85, reportCID: "bafy-report-11" });
        }

        throw new Error(`unexpected index ${index}`);
      }
    }
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(readIndexes, [2, 1]);
  assert.deepEqual(JSON.parse(writes[0] ?? ""), {
    status: "ok",
    tokenId: "1",
    profile: {
      developer: "0x000000000000000000000000000000000000dEaD",
      agentName: "risk-agent",
      tokenId: "1",
      totalBond: "1000",
      blacklisted: false,
      createdAt: 1710000000,
      lastAuditAt: 1710000100,
      auditCount: 4
    },
    paging: {
      offset: 1,
      limit: 2,
      total: 4,
      returned: 2,
      hasMore: true
    },
    audits: [
      {
        index: 2,
        auditId: 12,
        timestamp: 1710000100,
        auditScore: 90,
        memoryPeakMb: 64,
        cpuAvgMilli: 120,
        requestIpCount: 1,
        status: 2,
        manifestHash: `0x${"a".repeat(64)}`,
        reportHash: `0x${"b".repeat(64)}`,
        evidenceRoot: `0x${"c".repeat(64)}`,
        attestationHash: `0x${"d".repeat(64)}`,
        evidenceCID: "bafy-evidence",
        reportCID: "bafy-report-12",
        manifestUrl: "https://example.com/manifest.json",
        appealRequested: false,
        appealApproved: false
      },
      {
        index: 1,
        auditId: 11,
        timestamp: 1710000100,
        auditScore: 85,
        memoryPeakMb: 64,
        cpuAvgMilli: 120,
        requestIpCount: 1,
        status: 2,
        manifestHash: `0x${"a".repeat(64)}`,
        reportHash: `0x${"b".repeat(64)}`,
        evidenceRoot: `0x${"c".repeat(64)}`,
        attestationHash: `0x${"d".repeat(64)}`,
        evidenceCID: "bafy-evidence",
        reportCID: "bafy-report-11",
        manifestUrl: "https://example.com/manifest.json",
        appealRequested: false,
        appealApproved: false
      }
    ]
  });
});

test("runAgentRegistryHistoryCli returns not_found JSON for missing token", async () => {
  const writes: string[] = [];
  const exitCode = await runAgentRegistryHistoryCli(["--token-id", "7"], process.env, {
    readConfig: () => config,
    writeStdout: (line: string) => {
      writes.push(line);
    },
    readAgentProfile: async () => {
      throw new Error("execution reverted: TOKEN_NOT_FOUND");
    }
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(JSON.parse(writes[0] ?? ""), {
    status: "not_found",
    tokenId: "7"
  });
});

test("runAgentRegistryCli dispatches to history subcommand", async () => {
  const writes: string[] = [];
  const exitCode = await runAgentRegistryCli(
    ["history", "--token-id", "1", "--limit", "1"],
    process.env,
    {
      readConfig: () => config,
      writeStdout: (line: string) => {
        writes.push(line);
      },
      readAgentProfile: async () => buildProfile({ auditCount: 1 }),
      readAuditReportByIndex: async ({ index }) => {
        assert.equal(index, 0);
        return buildAuditReportByIndex({ auditId: 7, reportCID: "bafy-report-7" });
      }
    }
  );

  assert.equal(exitCode, 0);
  const result = JSON.parse(writes[0] ?? "");
  assert.equal(result.status, "ok");
  assert.equal(result.audits[0].auditId, 7);
});
