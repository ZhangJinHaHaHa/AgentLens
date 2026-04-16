import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { utils } from "ethers";
import { buildAuditReport } from "../../src/report/buildAuditReport";
import {
  getAuditRegistryInterface,
  getAuditRegistryV2Interface,
  getRecordAuditResultEntry,
  getRecordAuditResultV2Entry
} from "../../src/listener/auditRegistryArtifact";
import {
  createListenerRuntime,
  buildAuditRequestFromEvent,
  readListenerRuntimeConfigFromEnv
} from "../../src/listener/createListenerRuntime";
import type {
  AgentProfileOnChain,
  ReadAgentProfileOptions
} from "../../src/listener/readAgentProfile";
import type {
  AuditReportByIndex,
  ReadAuditReportByIndexOptions
} from "../../src/listener/readAuditReportByIndex";
import type { WriteSlashBondRequest } from "../../src/listener/writeSlashBond";
import type { IpfsHttpClientConfig } from "../../src/report/ipfsHttpClient";
import type {
  RemoteReportStorageDeps,
  StorePersistedAuditReportOptions
} from "../../src/report/storePersistedAuditReport";
import type { TencentCosReportStoreConfig } from "../../src/report/tencentCosReportStore";
import {
  resolveListenerReportsDir,
  resolveListenerStateDirFromEnv
} from "../../src/listener/listenerStatePaths";
import { buildStandardAuditRequest } from "../../src/audit/buildStandardAuditRequest";
import type { AuditRequestedEvent, ProcessedAuditRequested } from "../../src/listener/types";
import type { PersistedAuditReportArtifact } from "../../src/report/persistAuditReport";
import type { LocalAuditResult } from "../../src/types/manifest";

function buildEvent(overrides: Partial<AuditRequestedEvent> = {}): AuditRequestedEvent {
  return {
    eventKey: "0xabc:0",
    tokenId: 1n,
    developer: "0x000000000000000000000000000000000000dEaD",
    agentName: "risk-agent",
    manifestUrl: "https://example.com/manifest.json",
    blockNumber: 123,
    transactionHash: "0xabc",
    ...overrides
  };
}

function buildAuditResult(overrides: Partial<LocalAuditResult> = {}): LocalAuditResult {
  return {
    agentName: "risk-agent",
    manifestHash: "a".repeat(64),
    healthcheckPassed: true,
    answer: "safe result",
    actions: [{ type: "web_request", url: "https://api.risk.com/v1/alert" }],
    decisionType: "undetermined",
    cpuAvgMilli: 120,
    memoryPeakMb: 256,
    requestedIps: ["203.0.113.10"],
    requestedHosts: ["api.risk.com"],
    requestCount: 1,
    status: "completed",
    startedAt: "2026-03-23T10:00:00.000Z",
    finishedAt: "2026-03-23T10:00:05.000Z",
    ...overrides
  };
}

function buildProcessed(event: AuditRequestedEvent = buildEvent()): ProcessedAuditRequested {
  const auditResult = buildAuditResult();
  const reportPersistence: PersistedAuditReportArtifact = {
    reportFileName: "persisted-report.json",
    reportFilePath: "/tmp/reports/persisted-report.json"
  };

  return {
    event,
    auditResult,
    reportArtifact: buildAuditReport(auditResult),
    reportPersistence,
    writeback: {
      tokenId: event.tokenId,
      auditScore: 100,
      memoryPeakMb: 256,
      cpuAvgMilli: 120,
      requestIpCount: 1,
      status: "Passed",
      manifestHash: "a".repeat(64),
      reportHash: "b".repeat(64),
      reportCID: "",
      manifestUrl: event.manifestUrl
    }
  };
}

const contractInterface = getAuditRegistryInterface();

test("buildAuditRequestFromEvent creates the default sandbox audit payload for a polled event", () => {
  const event = buildEvent();
  const request = buildAuditRequestFromEvent(event);
  const expected = buildStandardAuditRequest({
    taskId: `audit-${event.transactionHash}-${event.tokenId}`,
    currentBlock: event.blockNumber,
    envVars: [`MANIFEST_URL=${event.manifestUrl}`],
    history: []
  });

  assert.deepEqual(request, expected);
});

test("createListenerRuntime wires report persistence into processAuditRequested", async () => {
  const event = buildEvent();
  const auditResult = buildAuditResult({
    manifestHash: "b".repeat(64)
  });
  const persistedCalls: Array<{ eventKey: string; reportHash: string; baseDir?: string }> = [];

  const runtime = createListenerRuntime(
    {
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 5000,
      writeback: { enabled: false }
    },
    {
      loadManifestSource: async () => ({
        manifest: {
          agent_name: "risk-agent",
          image: "agent-shenji/test-agent:local",
          allowed_hosts: ["api.risk.com"],
          allowed_rpc_endpoints: ["https://rpc.edge.local"]
        },
        manifestHash: "b".repeat(64),
        sourceContents: "{}"
      }),
      createLocalAuditRunOptions: (manifestLocation) => ({
        manifestPath: manifestLocation,
        request: buildStandardAuditRequest({
          taskId: "unused-local-audit-task",
          history: []
        }),
        pullImage: async () => {},
        startContainer: async () => ({
          containerId: "container-123",
          host: "127.0.0.1",
          port: 18080
        }),
        waitForHealth: async () => {},
        sendAuditRequest: async () => ({
          answer: "",
          actions: []
        }),
        collectResourceUsage: async () => ({
          cpuAvgMilli: 0,
          memoryPeakMb: 0
        }),
        collectNetworkActivity: async () => ({
          requestedIps: [],
          requestedHosts: [],
          requestCount: 0
        }),
        killContainer: async () => {},
        stopContainer: async () => {},
        removeContainer: async () => {}
      }),
      runLocalSandboxAudit: async (options) => {
        assert.equal(options.manifestPath, event.manifestUrl);
        assert.deepEqual(options.request, buildAuditRequestFromEvent(event));
        return auditResult;
      },
      persistAuditReport: async (options) => {
        persistedCalls.push({
          eventKey: options.event.eventKey,
          reportHash: options.reportArtifact.reportHash,
          baseDir: options.baseDir
        });
        return {
          reportFileName: "persisted-report.json",
          reportFilePath: "/tmp/reports/persisted-report.json"
        };
      }
    }
  );

  const processed = await runtime.processAuditRequested(event);

  assert.deepEqual(persistedCalls, [
    {
      eventKey: "0xabc:0",
      reportHash: processed.reportArtifact.reportHash,
      baseDir: "/tmp/listener-state/reports"
    }
  ]);
  assert.deepEqual(processed.reportPersistence, {
    reportFileName: "persisted-report.json",
    reportFilePath: "/tmp/reports/persisted-report.json"
  });
  assert.equal(processed.writeback.reportCID, "");
});

test("createListenerRuntime wires remote report storage into processAuditRequested", async () => {
  const event = buildEvent();
  const auditResult = buildAuditResult({
    manifestHash: "c".repeat(64)
  });
  const adapterCalls: string[] = [];
  const stored: Array<{
    reportFilePath: string;
    cosKeyPrefix?: string;
    putObject: unknown;
    addToIpfs: unknown;
  }> = [];
  const cosStore = {
    putObject: async () => {
      adapterCalls.push("cos-put");
    }
  };
  const ipfsClient = {
    addToIpfs: async () => {
      adapterCalls.push("ipfs-add");
      return { cid: "bafybeigdyrzt" };
    }
  };

  const runtime = createListenerRuntime(
    {
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 5000,
      writeback: { enabled: false },
      reportStorage: {
        cos: {
          mode: "tencent",
          secretId: "cos-secret",
          secretKey: "cos-key",
          bucket: "audit-reports",
          region: "ap-guangzhou",
          keyPrefix: "custom-prefix"
        },
        ipfs: {
          apiUrl: "https://ipfs.example/upload",
          authToken: "ipfs-token"
        }
      }
    },
    {
      loadManifestSource: async () => ({
        manifest: {
          agent_name: "risk-agent",
          image: "agent-shenji/test-agent:local",
          allowed_hosts: ["api.risk.com"],
          allowed_rpc_endpoints: ["https://rpc.edge.local"]
        },
        manifestHash: "c".repeat(64),
        sourceContents: "{}"
      }),
      createLocalAuditRunOptions: (manifestLocation) => ({
        manifestPath: manifestLocation,
        request: buildStandardAuditRequest({
          taskId: "unused-local-audit-task",
          history: []
        }),
        pullImage: async () => {},
        startContainer: async () => ({
          containerId: "container-123",
          host: "127.0.0.1",
          port: 18080
        }),
        waitForHealth: async () => {},
        sendAuditRequest: async () => ({
          answer: "",
          actions: []
        }),
        collectResourceUsage: async () => ({
          cpuAvgMilli: 0,
          memoryPeakMb: 0
        }),
        collectNetworkActivity: async () => ({
          requestedIps: [],
          requestedHosts: [],
          requestCount: 0
        }),
        killContainer: async () => {},
        stopContainer: async () => {},
        removeContainer: async () => {}
      }),
      runLocalSandboxAudit: async () => auditResult,
      persistAuditReport: async () => ({
        reportFileName: "persisted-report.json",
        reportFilePath: "/tmp/reports/persisted-report.json"
      }),
      createTencentCosReportStore: (config: TencentCosReportStoreConfig) => {
        adapterCalls.push(`cos:${config.bucket}`);
        return cosStore;
      },
      createIpfsHttpClient: (config: IpfsHttpClientConfig) => {
        adapterCalls.push(`ipfs:${config.apiUrl}`);
        return ipfsClient;
      },
      storePersistedAuditReport: async (
        options: StorePersistedAuditReportOptions,
        deps: RemoteReportStorageDeps
      ) => {
        stored.push({
          reportFilePath: options.reportPersistence.reportFilePath,
          cosKeyPrefix: options.cosKeyPrefix,
          putObject: deps.putObject,
          addToIpfs: deps.addToIpfs
        });
        return {
          reportCid: "bafybeigdyrzt",
          cosObjectKey: "reports/1/0xabc-0/c.json"
        };
      }
    }
  );

  const processed = await runtime.processAuditRequested(event);

  assert.deepEqual(adapterCalls, ["cos:audit-reports", "ipfs:https://ipfs.example/upload"]);
  assert.deepEqual(stored, [
    {
      reportFilePath: "/tmp/reports/persisted-report.json",
      cosKeyPrefix: "custom-prefix",
      putObject: cosStore.putObject,
      addToIpfs: ipfsClient.addToIpfs
    }
  ]);
  assert.equal(processed.writeback.reportCID, "bafybeigdyrzt");
});

test("readListenerRuntimeConfigFromEnv reads required listener settings and optional polling flags", () => {
  const config = readListenerRuntimeConfigFromEnv({
    AUDIT_RPC_URL: "https://rpc.edge.local",
    AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA",
    AUDIT_LISTENER_START_BLOCK: "120",
    AUDIT_LISTENER_POLL_INTERVAL_MS: "1500",
    AUDIT_LISTENER_STATE_DIR: "/tmp/listener-state"
  });

  assert.deepEqual(config, {
    rpcUrl: "https://rpc.edge.local",
    contractAddress: "0x000000000000000000000000000000000000aAaA",
    startBlock: 120,
    stateDir: "/tmp/listener-state",
    pollIntervalMs: 1500,
    writeback: {
      enabled: false
    }
  });
});

test("readListenerRuntimeConfigFromEnv defaults AUDIT_LISTENER_STATE_DIR under the sandbox runtime directory", () => {
  const config = readListenerRuntimeConfigFromEnv({
    AUDIT_RPC_URL: "https://rpc.edge.local",
    AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA"
  });

  assert.equal(config.stateDir, join(process.cwd(), ".runtime", "listener"));
});

test("resolveListenerStateDirFromEnv defaults to process.cwd()/.runtime/listener", () => {
  assert.equal(resolveListenerStateDirFromEnv({}), join(process.cwd(), ".runtime", "listener"));
});

test("resolveListenerStateDirFromEnv honors AUDIT_LISTENER_STATE_DIR when present", () => {
  assert.equal(
    resolveListenerStateDirFromEnv({
      AUDIT_LISTENER_STATE_DIR: "/tmp/custom-listener-state"
    }),
    "/tmp/custom-listener-state"
  );
});

test("resolveListenerReportsDir resolves to <stateDir>/reports", () => {
  assert.equal(resolveListenerReportsDir("/tmp/custom-listener-state"), "/tmp/custom-listener-state/reports");
});

test("readListenerRuntimeConfigFromEnv enables writeback only when AUDIT_WRITEBACK_ENABLED is true", () => {
  const disabled = readListenerRuntimeConfigFromEnv({
    AUDIT_RPC_URL: "https://rpc.edge.local",
    AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA",
    AUDIT_WRITEBACK_ENABLED: "false"
  });
  const enabled = readListenerRuntimeConfigFromEnv({
    AUDIT_RPC_URL: "https://rpc.edge.local",
    AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA",
    AUDIT_WRITEBACK_ENABLED: "true",
    AUDIT_OPERATOR_PRIVATE_KEY: `0x${"1".repeat(64)}`,
    AUDIT_CHAIN_ID: "31337",
    AUDIT_REPORT_COS_SECRET_ID: "cos-secret",
    AUDIT_REPORT_COS_SECRET_KEY: "cos-key",
    AUDIT_REPORT_COS_BUCKET: "audit-reports",
    AUDIT_REPORT_COS_REGION: "ap-guangzhou",
    AUDIT_REPORT_IPFS_API_URL: "https://ipfs.example/upload"
  });

  assert.deepEqual(disabled.writeback, {
    enabled: false
  });
  assert.deepEqual(enabled.writeback, {
    enabled: true,
    operatorPrivateKey: `0x${"1".repeat(64)}`,
    chainId: 31337
  });
  assert.deepEqual(enabled.reportStorage, {
    cos: {
      mode: "tencent",
      secretId: "cos-secret",
      secretKey: "cos-key",
      bucket: "audit-reports",
      region: "ap-guangzhou",
      keyPrefix: "reports"
    },
    ipfs: {
      apiUrl: "https://ipfs.example/upload",
      authToken: undefined
    }
  });
});

test("readListenerRuntimeConfigFromEnv leaves report storage disabled when writeback is enabled without storage env", () => {
  const config = readListenerRuntimeConfigFromEnv({
    AUDIT_RPC_URL: "https://rpc.edge.local",
    AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA",
    AUDIT_WRITEBACK_ENABLED: "true",
    AUDIT_OPERATOR_PRIVATE_KEY: `0x${"1".repeat(64)}`,
    AUDIT_CHAIN_ID: "31337"
  });

  assert.equal(config.reportStorage, undefined);
});

test("readListenerRuntimeConfigFromEnv supports local filesystem-backed report storage for local e2e", () => {
  const config = readListenerRuntimeConfigFromEnv({
    AUDIT_RPC_URL: "https://rpc.edge.local",
    AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA",
    AUDIT_WRITEBACK_ENABLED: "true",
    AUDIT_OPERATOR_PRIVATE_KEY: `0x${"1".repeat(64)}`,
    AUDIT_CHAIN_ID: "31337",
    AUDIT_REPORT_COS_LOCAL_DIR: "/tmp/local-report-store/cos",
    AUDIT_REPORT_IPFS_API_URL: "http://127.0.0.1:3301/api/v0/add"
  });

  assert.deepEqual(config.reportStorage, {
    cos: {
      mode: "local",
      localDir: "/tmp/local-report-store/cos",
      keyPrefix: "reports"
    },
    ipfs: {
      apiUrl: "http://127.0.0.1:3301/api/v0/add",
      authToken: undefined
    }
  });
});

test("readListenerRuntimeConfigFromEnv requires signer settings when writeback is enabled", () => {
  assert.throws(
    () =>
      readListenerRuntimeConfigFromEnv({
        AUDIT_RPC_URL: "https://rpc.edge.local",
        AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA",
        AUDIT_WRITEBACK_ENABLED: "true"
      }),
    /AUDIT_OPERATOR_PRIVATE_KEY is required/
  );

  assert.throws(
    () =>
      readListenerRuntimeConfigFromEnv({
        AUDIT_RPC_URL: "https://rpc.edge.local",
        AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA",
        AUDIT_WRITEBACK_ENABLED: "true",
        AUDIT_OPERATOR_PRIVATE_KEY: "0x1234"
      }),
    /AUDIT_CHAIN_ID is required/
  );
});

test("readListenerRuntimeConfigFromEnv rejects malformed AUDIT_OPERATOR_PRIVATE_KEY when writeback is enabled", () => {
  assert.throws(
    () =>
      readListenerRuntimeConfigFromEnv({
        AUDIT_RPC_URL: "https://rpc.edge.local",
        AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA",
        AUDIT_WRITEBACK_ENABLED: "true",
        AUDIT_OPERATOR_PRIVATE_KEY: "0x1234",
        AUDIT_CHAIN_ID: "31337"
      }),
    /AUDIT_OPERATOR_PRIVATE_KEY must be a 32-byte hex private key/
  );
});

test("readListenerRuntimeConfigFromEnv rejects invalid AUDIT_CHAIN_ID format when writeback is enabled", () => {
  assert.throws(
    () =>
      readListenerRuntimeConfigFromEnv({
        AUDIT_RPC_URL: "https://rpc.edge.local",
        AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA",
        AUDIT_WRITEBACK_ENABLED: "true",
        AUDIT_OPERATOR_PRIVATE_KEY: `0x${"1".repeat(64)}`,
        AUDIT_CHAIN_ID: "31337.5"
      }),
    /AUDIT_CHAIN_ID must be a non-negative integer/
  );
});

test("createListenerRuntime keeps summary logging only when writeback is disabled", async () => {
  const submittedTransactions: unknown[] = [];
  const sequence: string[] = [];
  const originalWrite = process.stdout.write;
  const stdoutChunks: string[] = [];
  const processed = buildProcessed();
  processed.writeback.reportCID = "bafybeigdyrzt";
  (processed as { reportStorage?: unknown }).reportStorage = {
    outcome: "stored",
    cosObjectKey: "reports/1/0xabc-0/persisted-report.json"
  };
  process.stdout.write = ((chunk: unknown) => {
    sequence.push("summary");
    stdoutChunks.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    const runtime = createListenerRuntime(
      {
        rpcUrl: "https://rpc.edge.local",
        contractAddress: "0x1111111111111111111111111111111111111111",
        pollIntervalMs: 5000,
        writeback: {
          enabled: false
        }
      },
      {
        createJsonRpcWriteClient: () => ({
          submitTransaction: async (request) => {
            submittedTransactions.push(request);
            sequence.push("writeback");
            return {
              transactionHash: `0x${"f".repeat(64)}`,
              blockNumber: 99
            };
          }
        })
      }
    );

    await runtime.writeAuditResult?.(processed);
  } finally {
    process.stdout.write = originalWrite;
  }

  assert.equal(submittedTransactions.length, 0);
  assert.deepEqual(sequence, ["summary"]);
  assert.match(stdoutChunks.join(""), /"type": "audit-processed"/);
  assert.match(stdoutChunks.join(""), /"reportCID": "bafybeigdyrzt"/);
  assert.match(stdoutChunks.join(""), /"reportStorageOutcome": "stored"/);
});

test("createListenerRuntime logs summary first and writes encoded calldata when writeback is enabled", async () => {
  assert.deepEqual(
    getRecordAuditResultEntry().inputs.map((input) => input.type),
    ["uint256", "uint32", "uint32", "uint32", "uint32", "uint8", "bytes32", "bytes32", "bytes32", "bytes32", "string", "string", "string"]
  );

  const submittedTransactions: Array<{ to: string; data: `0x${string}` }> = [];
  const sequence: string[] = [];
  const expectedReceipt: { transactionHash: `0x${string}`; blockNumber: number } = {
    transactionHash: `0x${"e".repeat(64)}` as `0x${string}`,
    blockNumber: 101
  };
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: unknown) => {
    sequence.push("summary");
    return true;
  }) as typeof process.stdout.write;

  try {
    const runtime = createListenerRuntime(
      {
        rpcUrl: "https://rpc.edge.local",
        contractAddress: "0x1111111111111111111111111111111111111111",
        pollIntervalMs: 777,
        fetchImpl: (() => {
          throw new Error("fetch should not be called in this test");
        }) as typeof fetch,
        writeback: {
          enabled: true,
          operatorPrivateKey: "0x1234",
          chainId: 31337
        }
      },
      {
        createJsonRpcWriteClient: (options) => {
          assert.equal(options.rpcUrl, "https://rpc.edge.local");
          assert.equal(options.chainId, 31337);
          assert.equal(options.privateKey, "0x1234");
          assert.equal(options.pollIntervalMs, 777);
          assert.ok(options.fetchImpl);

          return {
            submitTransaction: async (request) => {
              sequence.push("writeback");
              submittedTransactions.push(request);
              return expectedReceipt;
            }
          };
        }
      }
    );

    const receipt = await runtime.writeAuditResult?.(buildProcessed());
    assert.deepEqual(receipt, expectedReceipt);
  } finally {
    process.stdout.write = originalWrite;
  }

  assert.deepEqual(sequence, ["summary", "writeback"]);
  assert.equal(submittedTransactions.length, 1);
  assert.equal(submittedTransactions[0]?.to, "0x1111111111111111111111111111111111111111");

  const decoded = contractInterface.decodeFunctionData(
    "recordAuditResult",
    submittedTransactions[0]?.data ?? "0x"
  );
  assert.equal(decoded[0]?.toString(), "1");
  assert.equal(decoded[1]?.toString(), "100");
  assert.equal(decoded[2]?.toString(), "256");
  assert.equal(decoded[3]?.toString(), "120");
  assert.equal(decoded[4]?.toString(), "1");
  assert.equal(decoded[5]?.toString(), "1");
  assert.equal(decoded[6], `0x${"a".repeat(64)}`);
  assert.equal(decoded[7], `0x${"b".repeat(64)}`);
  assert.equal(decoded[8], `0x${"0".repeat(64)}`);
  assert.equal(decoded[9], `0x${"0".repeat(64)}`);
  assert.equal(decoded[10], "");
  assert.equal(decoded[11], "");
  assert.equal(decoded[12], "https://example.com/manifest.json");
});

test("createListenerRuntime exposes slash-phase contract helpers when writeback is enabled", async () => {
  const profileCalls: bigint[] = [];
  const reportCalls: Array<{ tokenId: bigint; index: number }> = [];
  const slashCalls: Array<{
    tokenId: bigint;
    auditId: number;
    amount: bigint;
    reasonCode: string;
  }> = [];
  const expectedProfile: AgentProfileOnChain = {
    developer: "0x000000000000000000000000000000000000dEaD",
    agentName: "risk-agent",
    tokenId: 1n,
    totalBond: 1000000000000000000n,
    blacklisted: false,
    createdAt: 1774536000,
    lastAuditAt: 1774536086,
    auditCount: 3
  };
  const expectedRecord: AuditReportByIndex = {
    auditId: 2,
    timestamp: 1774536086,
    auditScore: 0,
    memoryPeakMb: 256,
    cpuAvgMilli: 120,
    requestIpCount: 1,
    status: 2,
    manifestHash: `0x${"a".repeat(64)}`,
    reportHash: `0x${"b".repeat(64)}`,
    reportCID: "bafybeigdyrzt",
    manifestUrl: "https://example.com/manifest.json",
    appealRequested: false,
    appealApproved: false
  };
  const expectedReceipt = {
    transactionHash: `0x${"f".repeat(64)}` as `0x${string}`,
    blockNumber: 88,
    logs: []
  };

  const runtime = createListenerRuntime(
    {
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      pollIntervalMs: 5000,
      writeback: {
        enabled: true,
        operatorPrivateKey: "0x1234",
        chainId: 31337
      }
    },
    {
      createJsonRpcWriteClient: () => ({
        submitTransaction: async () => expectedReceipt
      }),
      readAgentProfile: async ({ tokenId }: ReadAgentProfileOptions) => {
        profileCalls.push(tokenId);
        return expectedProfile;
      },
      readAuditReportByIndex: async ({ tokenId, index }: ReadAuditReportByIndexOptions) => {
        reportCalls.push({ tokenId, index });
        return expectedRecord;
      },
      writeSlashBond: async (request: WriteSlashBondRequest) => {
        slashCalls.push(request);
        return expectedReceipt;
      }
    } as Parameters<typeof createListenerRuntime>[1]
  );

  const profile = await runtime.readAgentProfile?.(1n);
  const record = await runtime.readAuditReportByIndex?.(1n, 1);
  const receipt = await runtime.submitSlashBond?.({
    tokenId: 1n,
    auditId: 2,
    amount: 1000000000000000000n,
    reasonCode: "ACTION_MISMATCH"
  });

  assert.deepEqual(profileCalls, [1n]);
  assert.deepEqual(reportCalls, [{ tokenId: 1n, index: 1 }]);
  assert.deepEqual(slashCalls, [
    {
      tokenId: 1n,
      auditId: 2,
      amount: 1000000000000000000n,
      reasonCode: "ACTION_MISMATCH"
    }
  ]);
  assert.deepEqual(profile, expectedProfile);
  assert.deepEqual(record, expectedRecord);
  assert.deepEqual(receipt, expectedReceipt);
});

test("createListenerRuntime exposes compensateBond helper when writeback is enabled", async () => {
  const compensateCalls: Array<{
    tokenId: bigint;
    auditId: number;
    amount: bigint;
    reasonCode: string;
  }> = [];
  const expectedReceipt = {
    transactionHash: `0x${"c".repeat(64)}` as `0x${string}`,
    blockNumber: 99,
    logs: []
  };

  const runtime = createListenerRuntime(
    {
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      pollIntervalMs: 5000,
      writeback: {
        enabled: true,
        operatorPrivateKey: "0x1234",
        chainId: 31337
      }
    },
    {
      createJsonRpcWriteClient: () => ({
        submitTransaction: async () => expectedReceipt
      }),
      writeCompensateBond: async (request) => {
        compensateCalls.push(request);
        return expectedReceipt;
      }
    } as Parameters<typeof createListenerRuntime>[1]
  );

  assert.ok(runtime.submitCompensateBond, "compensateBond should be available when writeback is enabled");

  const receipt = await runtime.submitCompensateBond?.({
    tokenId: 1n,
    auditId: 2,
    amount: 500000000000000000n,
    reasonCode: "APPEAL_APPROVED"
  });

  assert.deepEqual(compensateCalls, [
    {
      tokenId: 1n,
      auditId: 2,
      amount: 500000000000000000n,
      reasonCode: "APPEAL_APPROVED"
    }
  ]);
  assert.deepEqual(receipt, expectedReceipt);
});

test("createListenerRuntime does not expose compensateBond when writeback is disabled", () => {
  const runtime = createListenerRuntime(
    {
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      pollIntervalMs: 5000,
      writeback: { enabled: false }
    }
  );

  assert.equal(runtime.submitCompensateBond, undefined);
  assert.equal(runtime.evaluateSlashDecision, undefined);
  assert.equal(runtime.handlePostWritebackSlash, undefined);
});

test("createListenerRuntime wires evaluateSlashDecision and handlePostWritebackSlash when writeback is enabled", async () => {
  const slashBondCalls: WriteSlashBondRequest[] = [];
  const profileCalls: bigint[] = [];
  const expectedProfile: AgentProfileOnChain = {
    developer: "0x000000000000000000000000000000000000dEaD",
    agentName: "risk-agent",
    tokenId: 1n,
    totalBond: 2000000000000000000n,
    blacklisted: false,
    createdAt: 1774536000,
    lastAuditAt: 1774536086,
    auditCount: 3
  };
  const expectedReceipt = {
    transactionHash: `0x${"d".repeat(64)}` as `0x${string}`,
    blockNumber: 150,
    logs: []
  };

  const runtime = createListenerRuntime(
    {
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      pollIntervalMs: 5000,
      writeback: {
        enabled: true,
        operatorPrivateKey: "0x1234",
        chainId: 31337
      }
    },
    {
      createJsonRpcWriteClient: () => ({
        submitTransaction: async () => expectedReceipt
      }),
      readAgentProfile: async ({ tokenId }: ReadAgentProfileOptions) => {
        profileCalls.push(tokenId);
        return expectedProfile;
      },
      writeSlashBond: async (request: WriteSlashBondRequest) => {
        slashBondCalls.push(request);
        return expectedReceipt;
      }
    } as Parameters<typeof createListenerRuntime>[1]
  );

  assert.ok(runtime.evaluateSlashDecision, "evaluateSlashDecision should be available");
  assert.ok(runtime.handlePostWritebackSlash, "handlePostWritebackSlash should be available");

  const failedProcessed = buildProcessed();
  failedProcessed.auditResult = buildAuditResult({
    status: "failed",
    reasonCode: "UNDECLARED_EGRESS",
    decisionType: "redline_violation",
    answer: "",
    actions: []
  });
  failedProcessed.writeback = {
    ...failedProcessed.writeback,
    status: "Failed",
    auditScore: 0
  };

  const decision = runtime.evaluateSlashDecision!(failedProcessed);
  assert.equal(decision.outcome, "slash");
  assert.equal(decision.reasonCode, "UNDECLARED_EGRESS");

  await runtime.handlePostWritebackSlash!({
    processed: failedProcessed,
    decision
  });

  assert.deepEqual(profileCalls, [failedProcessed.writeback.tokenId]);
  assert.equal(slashBondCalls.length, 1);
  assert.equal(slashBondCalls[0]!.tokenId, failedProcessed.writeback.tokenId);
  assert.equal(slashBondCalls[0]!.auditId, expectedProfile.auditCount);
  assert.equal(slashBondCalls[0]!.amount, expectedProfile.totalBond);
  assert.equal(slashBondCalls[0]!.reasonCode, "UNDECLARED_EGRESS");

  const passingProcessed = buildProcessed();
  const passingDecision = runtime.evaluateSlashDecision!(passingProcessed);
  assert.equal(passingDecision.outcome, "none");
});

test("readListenerRuntimeConfigFromEnv reads AUDIT_DOCKER_NETWORK when present", () => {
  const config = readListenerRuntimeConfigFromEnv({
    AUDIT_RPC_URL: "https://rpc.edge.local",
    AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA",
    AUDIT_DOCKER_NETWORK: "polygon-edge-external_default"
  });

  assert.equal(config.dockerNetwork, "polygon-edge-external_default");
});

test("readListenerRuntimeConfigFromEnv leaves dockerNetwork undefined when AUDIT_DOCKER_NETWORK is not set", () => {
  const config = readListenerRuntimeConfigFromEnv({
    AUDIT_RPC_URL: "https://rpc.edge.local",
    AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA"
  });

  assert.equal(config.dockerNetwork, undefined);
});

test("readListenerRuntimeConfigFromEnv reads LLM question config when AUDIT_LLM_PROVIDER is set", () => {
  const config = readListenerRuntimeConfigFromEnv({
    AUDIT_RPC_URL: "https://rpc.edge.local",
    AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA",
    AUDIT_LLM_PROVIDER: "mock",
    AUDIT_QUESTION_COUNT: "3"
  });

  assert.ok(config.questionConfig);
  assert.equal(config.questionConfig.provider, "mock");
  assert.equal(config.questionConfig.questionCount, 3);
});

test("readListenerRuntimeConfigFromEnv leaves questionConfig undefined when AUDIT_LLM_PROVIDER is not set", () => {
  const config = readListenerRuntimeConfigFromEnv({
    AUDIT_RPC_URL: "https://rpc.edge.local",
    AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA"
  });

  assert.equal(config.questionConfig, undefined);
});

test("readListenerRuntimeConfigFromEnv reads attestation config when AUDIT_ATTESTATION_API_URL is set", () => {
  const config = readListenerRuntimeConfigFromEnv({
    AUDIT_RPC_URL: "https://rpc.edge.local",
    AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA",
    AUDIT_ATTESTATION_API_URL: "https://attest.example.com/api/v1/attest",
    AUDIT_ATTESTATION_AUTH_TOKEN: "secret-token",
    AUDIT_ATTESTATION_TIMEOUT_MS: "5000"
  });

  assert.ok(config.attestation);
  assert.equal(config.attestation.apiUrl, "https://attest.example.com/api/v1/attest");
  assert.equal(config.attestation.authToken, "secret-token");
  assert.equal(config.attestation.timeoutMs, 5000);
});

test("readListenerRuntimeConfigFromEnv leaves attestation undefined when AUDIT_ATTESTATION_API_URL is not set", () => {
  const config = readListenerRuntimeConfigFromEnv({
    AUDIT_RPC_URL: "https://rpc.edge.local",
    AUDIT_REGISTRY_ADDRESS: "0x000000000000000000000000000000000000aAaA"
  });

  assert.equal(config.attestation, undefined);
});

test("createListenerRuntime passes dockerNetwork to createLocalAuditRunOptions", async () => {
  const event = buildEvent();
  const auditResult = buildAuditResult({ manifestHash: "b".repeat(64) });
  const receivedOverrides: Array<{ networkName?: string }> = [];

  const runtime = createListenerRuntime(
    {
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 5000,
      writeback: { enabled: false },
      dockerNetwork: "my-docker-network"
    },
    {
      loadManifestSource: async () => ({
        manifest: {
          agent_name: "risk-agent",
          image: "agent-shenji/test-agent:local",
          allowed_hosts: ["api.risk.com"],
          allowed_rpc_endpoints: ["https://rpc.edge.local"]
        },
        manifestHash: "b".repeat(64),
        sourceContents: "{}"
      }),
      createLocalAuditRunOptions: (manifestLocation, overrides) => {
        receivedOverrides.push(overrides ?? {});
        return {
          manifestPath: manifestLocation,
          request: buildStandardAuditRequest({ taskId: "unused", history: [] }),
          pullImage: async () => {},
          startContainer: async () => ({ containerId: "c-123", host: "127.0.0.1", port: 18080 }),
          waitForHealth: async () => {},
          sendAuditRequest: async () => ({ answer: "", actions: [] }),
          collectResourceUsage: async () => ({ cpuAvgMilli: 0, memoryPeakMb: 0 }),
          collectNetworkActivity: async () => ({ requestedIps: [], requestedHosts: [], requestCount: 0 }),
          killContainer: async () => {},
          stopContainer: async () => {},
          removeContainer: async () => {}
        };
      },
      runLocalSandboxAudit: async () => auditResult,
      persistAuditReport: async () => ({
        reportFileName: "report.json",
        reportFilePath: "/tmp/reports/report.json"
      })
    }
  );

  await runtime.processAuditRequested(event);

  assert.equal(receivedOverrides.length, 1);
  assert.equal(receivedOverrides[0]?.networkName, "my-docker-network");
});

test("createListenerRuntime wires attestation client into processAuditRequested when attestation config is present", async () => {
  const event = buildEvent();
  const auditResult = buildAuditResult({ manifestHash: "b".repeat(64) });
  const attestationCalls: string[] = [];

  const runtime = createListenerRuntime(
    {
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 5000,
      writeback: { enabled: false },
      attestation: {
        apiUrl: "https://attest.example.com",
        providerType: "http-tee",
        timeoutMs: 10000
      }
    },
    {
      loadManifestSource: async () => ({
        manifest: {
          agent_name: "risk-agent",
          image: "agent-shenji/test-agent:local",
          allowed_hosts: ["api.risk.com"],
          allowed_rpc_endpoints: ["https://rpc.edge.local"]
        },
        manifestHash: "b".repeat(64),
        sourceContents: "{}"
      }),
      createLocalAuditRunOptions: (manifestLocation) => ({
        manifestPath: manifestLocation,
        request: buildStandardAuditRequest({ taskId: "unused", history: [] }),
        pullImage: async () => {},
        startContainer: async () => ({ containerId: "c-123", host: "127.0.0.1", port: 18080 }),
        waitForHealth: async () => {},
        sendAuditRequest: async () => ({ answer: "", actions: [] }),
        collectResourceUsage: async () => ({ cpuAvgMilli: 0, memoryPeakMb: 0 }),
        collectNetworkActivity: async () => ({ requestedIps: [], requestedHosts: [], requestCount: 0 }),
        killContainer: async () => {},
        stopContainer: async () => {},
        removeContainer: async () => {}
      }),
      runLocalSandboxAudit: async () => auditResult,
      persistAuditReport: async () => ({
        reportFileName: "report.json",
        reportFilePath: "/tmp/reports/report.json"
      }),
      createHttpAttestationClient: (config) => {
        attestationCalls.push(`create:${config.apiUrl}`);
        return {
          createAuditAttestation: async (input) => {
            attestationCalls.push(`attest:${input.event.eventKey}`);
            return {
              attestationHash: "f".repeat(64),
              bundle: {
                schemaVersion: "audit-attestation.v1",
                eventKey: input.event.eventKey,
                tokenId: input.event.tokenId.toString(),
                manifestHash: input.manifestHash,
                evidenceRoot: input.evidenceRoot,
                verifier: {
                  type: "http-tee",
                  measurement: "m".repeat(64),
                  quoteFormat: "mock-quote",
                  sessionPublicKey: "spk",
                  quote: "q"
                }
              },
              bundleJson: "{}"
            };
          }
        };
      }
    }
  );

  assert.deepEqual(attestationCalls, ["create:https://attest.example.com"]);

  const processed = await runtime.processAuditRequested(event);

  assert.deepEqual(attestationCalls, [
    "create:https://attest.example.com",
    "attest:0xabc:0"
  ]);
  assert.equal(processed.evidence?.attestationHash, "f".repeat(64));
  assert.equal(processed.writeback.attestationHash, "f".repeat(64));
});

test("createListenerRuntime encodes recordAuditResultV2 calldata when dimensionalScores are present", async () => {
  assert.deepEqual(
    getRecordAuditResultV2Entry().inputs.map((input) => input.type),
    [
      "uint256",
      "uint32",
      "uint32",
      "uint32",
      "uint32",
      "uint8",
      "bytes32",
      "bytes32",
      "bytes32",
      "bytes32",
      "string",
      "string",
      "string",
      "tuple"
    ]
  );

  const v2Interface = getAuditRegistryV2Interface();
  const submittedTransactions: Array<{ to: string; data: `0x${string}` }> = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (() => true) as typeof process.stdout.write;

  try {
    const runtime = createListenerRuntime(
      {
        rpcUrl: "https://rpc.edge.local",
        contractAddress: "0x2222222222222222222222222222222222222222",
        pollIntervalMs: 777,
        fetchImpl: (() => {
          throw new Error("fetch should not be called in this test");
        }) as typeof fetch,
        writeback: {
          enabled: true,
          operatorPrivateKey: "0x1234",
          chainId: 31337
        }
      },
      {
        createJsonRpcWriteClient: () => ({
          submitTransaction: async (request) => {
            submittedTransactions.push(request);
            return {
              transactionHash: `0x${"a".repeat(64)}` as `0x${string}`,
              blockNumber: 201
            };
          }
        })
      }
    );

    const processed = buildProcessed();
    processed.writeback.evidenceRoot = "e".repeat(64);
    processed.writeback.attestationHash = "f".repeat(64);
    processed.writeback.dimensionalScores = {
      security: 8500,
      taskExecution: 7200,
      cognitive: 6100,
      environment: 9000,
      engineering: 7800,
      compliance: 9500
    };

    await runtime.writeAuditResult?.(processed);
  } finally {
    process.stdout.write = originalWrite;
  }

  assert.equal(submittedTransactions.length, 1);
  const decoded = v2Interface.decodeFunctionData(
    "recordAuditResultV2",
    submittedTransactions[0]?.data ?? "0x"
  );

  assert.equal(decoded[0]?.toString(), "1");
  assert.equal(decoded[1]?.toString(), "100");
  assert.equal(decoded[2]?.toString(), "256");
  assert.equal(decoded[3]?.toString(), "120");
  assert.equal(decoded[4]?.toString(), "1");
  assert.equal(decoded[5]?.toString(), "1");
  assert.equal(decoded[6], `0x${"a".repeat(64)}`);
  assert.equal(decoded[7], `0x${"b".repeat(64)}`);
  assert.equal(decoded[8], `0x${"e".repeat(64)}`);
  assert.equal(decoded[9], `0x${"f".repeat(64)}`);
  assert.equal(decoded[10], "");
  assert.equal(decoded[11], "");
  assert.equal(decoded[12], "https://example.com/manifest.json");

  const scores = decoded[13] as unknown as [number, number, number, number, number, number];
  assert.equal(scores[0], 8500);
  assert.equal(scores[1], 7200);
  assert.equal(scores[2], 6100);
  assert.equal(scores[3], 9000);
  assert.equal(scores[4], 7800);
  assert.equal(scores[5], 9500);
});
