import test from "node:test";
import assert from "node:assert/strict";

import { buildAuditReport } from "../../src/report/buildAuditReport";
import {
  resolveInitialFromBlock,
  runListenerCli
} from "../../src/cli/listener";
import { getAuditRegistryInterface } from "../../src/listener/auditRegistryArtifact";
import type { ListenerServiceStatus } from "../../src/listener/listenerServiceState";
import type {
  ListenerAuditExecutionRetryItem,
  AuditRequestedEvent,
  ListenerSlashRetryItem,
  ListenerRetryQueueItem,
  ProcessedAuditRequested
} from "../../src/listener/types";
import type { PersistedAuditReportArtifact } from "../../src/report/persistAuditReport";
import type { LocalAuditResult } from "../../src/types/manifest";
import type { WriteSlashBondRequest } from "../../src/listener/writeSlashBond";

const contractInterface = getAuditRegistryInterface();
const CONTRACT_ADDRESS = "0x1111111111111111111111111111111111111111";

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

function buildProcessed(
  event: AuditRequestedEvent = buildEvent(),
  auditResult: LocalAuditResult = buildAuditResult()
): ProcessedAuditRequested {
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

function buildAuditRecordedReceipt(tokenId: bigint, auditId: number): {
  transactionHash: `0x${string}`;
  blockNumber: number;
  logs: Array<{
    address: string;
    data: `0x${string}`;
    topics: `0x${string}`[];
  }>;
} {
  const encoded = contractInterface.encodeEventLog(
    contractInterface.getEvent("AuditRecorded"),
    [tokenId, auditId, 2, 0, `0x${"b".repeat(64)}`, "bafybeigdyrzt"]
  );

  return {
    transactionHash: "0xwriteback",
    blockNumber: 130,
    logs: [
      {
        address: CONTRACT_ADDRESS,
        data: encoded.data as `0x${string}`,
        topics: encoded.topics as `0x${string}`[]
      }
    ]
  };
}

function createState(overrides: Partial<{
  cursor: number | undefined;
  queue: ListenerRetryQueueItem[];
  auditExecutionQueue: ListenerAuditExecutionRetryItem[];
  slashQueue: ListenerSlashRetryItem[];
}> = {}): {
  instance: {
    stateDir: string;
    readCursor: () => Promise<number | undefined>;
    writeCursor: (nextBlock: number) => Promise<void>;
    readRetryQueue: () => Promise<ListenerRetryQueueItem[]>;
    enqueueRetry: (item: ListenerRetryQueueItem) => Promise<void>;
    upsertRetry: (item: ListenerRetryQueueItem) => Promise<void>;
    removeRetry: (eventKey: string) => Promise<void>;
    readAuditExecutionRetryQueue: () => Promise<ListenerAuditExecutionRetryItem[]>;
    enqueueAuditExecutionRetry: (item: ListenerAuditExecutionRetryItem) => Promise<void>;
    upsertAuditExecutionRetry: (item: ListenerAuditExecutionRetryItem) => Promise<void>;
    removeAuditExecutionRetry: (eventKey: string) => Promise<void>;
    readSlashRetryQueue: () => Promise<ListenerSlashRetryItem[]>;
    enqueueSlashRetry: (item: ListenerSlashRetryItem) => Promise<void>;
    upsertSlashRetry: (item: ListenerSlashRetryItem) => Promise<void>;
    removeSlashRetry: (eventKey: string) => Promise<void>;
  };
  writes: number[];
  queued: ListenerRetryQueueItem[];
  auditExecutionQueued: ListenerAuditExecutionRetryItem[];
  slashQueued: ListenerSlashRetryItem[];
} {
  let cursor = overrides.cursor;
  let queue = overrides.queue ? [...overrides.queue] : [];
  let auditExecutionQueue = overrides.auditExecutionQueue ? [...overrides.auditExecutionQueue] : [];
  let slashQueue = overrides.slashQueue ? [...overrides.slashQueue] : [];
  const writes: number[] = [];
  const queued: ListenerRetryQueueItem[] = [];
  const auditExecutionQueued: ListenerAuditExecutionRetryItem[] = [];
  const slashQueued: ListenerSlashRetryItem[] = [];

  return {
    instance: {
      stateDir: "/tmp/listener-state",
      readCursor: async () => cursor,
      writeCursor: async (nextBlock) => {
        cursor = nextBlock;
        writes.push(nextBlock);
      },
      readRetryQueue: async () => [...queue],
      enqueueRetry: async (item) => {
        queued.push(item);
        queue.push(item);
      },
      upsertRetry: async (item) => {
        const index = queue.findIndex((existing) => existing.eventKey === item.eventKey);
        if (index === -1) {
          queue.push(item);
          return;
        }

        queue[index] = item;
      },
      removeRetry: async (eventKey) => {
        queue = queue.filter((item) => item.eventKey !== eventKey);
      },
      readAuditExecutionRetryQueue: async () => [...auditExecutionQueue],
      enqueueAuditExecutionRetry: async (item) => {
        auditExecutionQueued.push(item);
        if (auditExecutionQueue.some((existing) => existing.eventKey === item.eventKey)) {
          return;
        }

        auditExecutionQueue.push(item);
      },
      upsertAuditExecutionRetry: async (item) => {
        const index = auditExecutionQueue.findIndex(
          (existing) => existing.eventKey === item.eventKey
        );
        if (index === -1) {
          auditExecutionQueue.push(item);
          return;
        }

        auditExecutionQueue[index] = item;
      },
      removeAuditExecutionRetry: async (eventKey) => {
        auditExecutionQueue = auditExecutionQueue.filter((item) => item.eventKey !== eventKey);
      },
      readSlashRetryQueue: async () => [...slashQueue],
      enqueueSlashRetry: async (item) => {
        slashQueued.push(item);
        if (slashQueue.some((existing) => existing.eventKey === item.eventKey)) {
          return;
        }

        slashQueue.push(item);
      },
      upsertSlashRetry: async (item) => {
        const index = slashQueue.findIndex((existing) => existing.eventKey === item.eventKey);
        if (index === -1) {
          slashQueue.push(item);
          return;
        }

        slashQueue[index] = item;
      },
      removeSlashRetry: async (eventKey) => {
        slashQueue = slashQueue.filter((item) => item.eventKey !== eventKey);
      }
    },
    writes,
    queued,
    auditExecutionQueued,
    slashQueued
  };
}

test("resolveInitialFromBlock prefers explicit startBlock over persisted cursor", async () => {
  const resolved = await resolveInitialFromBlock(
    {
      startBlock: 220,
      stateDir: "/tmp/listener-state",
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      pollIntervalMs: 1000,
      writeback: { enabled: false }
    },
    {
      readCursor: async () => 150
    },
    async () => 120
  );

  assert.deepEqual(resolved, {
    fromBlock: 220,
    source: "env"
  });
});

test("resolveInitialFromBlock prefers persisted cursor over chain head bootstrap", async () => {
  const resolved = await resolveInitialFromBlock(
    {
      stateDir: "/tmp/listener-state",
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      pollIntervalMs: 1000,
      writeback: { enabled: false }
    },
    {
      readCursor: async () => 151
    },
    async () => 120
  );

  assert.deepEqual(resolved, {
    fromBlock: 151,
    source: "cursor"
  });
});

test("runListenerCli saves the returned nextBlock after one poll", async () => {
  const state = createState({ cursor: 140 });
  const events: Array<Record<string, unknown>> = [];

  await runListenerCli(["--once"], process.env, {
    emitEvent: (event) => {
      events.push(event);
    },
    readConfig: () => ({
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 1000,
      writeback: { enabled: false }
    }),
    createPersistentState: () => state.instance,
    createRuntime: () => ({
      deduper: {
        claim: () => true,
        has: () => false
      },
      getLatestBlockNumber: async () => 140,
      pollAuditRequestedLogs: async () => [],
      processAuditRequested: async () => buildProcessed()
    }),
    flushRetryQueue: async () => [],
    runListenerOnce: async () => ({
      processed: [],
      latestBlockNumber: 140,
      nextBlock: 141
    })
  });

  assert.deepEqual(state.writes, [141]);
  assert.ok(events.some((event) => event.type === "listener-cursor-saved" && event.nextBlock === 141));
});

test("runListenerCli queues a failed fresh writeback and continues the poll cycle", async () => {
  const state = createState({ cursor: 123 });
  const processed = buildProcessed();
  const events: Array<Record<string, unknown>> = [];

  await runListenerCli(["--once"], process.env, {
    now: () => new Date("2026-03-27T10:21:00.000Z"),
    emitEvent: (event) => {
      events.push(event);
    },
    readConfig: () => ({
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 1000,
      writeback: {
        enabled: true,
        operatorPrivateKey: `0x${"1".repeat(64)}`,
        chainId: 31337
      }
    }),
    createPersistentState: () => state.instance,
    createRuntime: () => ({
      deduper: {
        claim: () => true,
        has: () => false
      },
      getLatestBlockNumber: async () => 123,
      pollAuditRequestedLogs: async () => [processed.event],
      processAuditRequested: async () => processed,
      writeAuditResult: async () => {
        throw new Error("send failed");
      },
      readLatestAuditReport: async () => {
        throw new Error("not used");
      },
      submitRetryWriteback: async () => {
        throw new Error("not used");
      }
    }),
    flushRetryQueue: async () => [],
    runListenerOnce: async ({ writeAuditResult }) => {
      await writeAuditResult?.(processed);
      return {
        processed: [processed],
        latestBlockNumber: 123,
        nextBlock: 124
      };
    }
  });

  assert.equal(state.queued.length, 1);
  assert.deepEqual(
    {
      eventKey: state.queued[0]?.eventKey,
      attemptCount: state.queued[0]?.attemptCount,
      nextAttemptAt: state.queued[0]?.nextAttemptAt,
      lastError: state.queued[0]?.lastError
    },
    {
      eventKey: "0xabc:0",
      attemptCount: 1,
      nextAttemptAt: "2026-03-27T10:21:10.000Z",
      lastError: "Error: send failed"
    }
  );
  assert.ok(events.some((event) => event.type === "writeback-failed"));
  assert.ok(events.some((event) => event.type === "writeback-retry-queued"));
  assert.ok(events.some((event) => event.type === "listener-poll" && event.processedCount === 1));
});

test("runListenerCli flushes queued retries before polling new logs", async () => {
  const state = createState({ cursor: 200 });
  const sequence: string[] = [];
  const events: Array<Record<string, unknown>> = [];

  await runListenerCli(["--once"], process.env, {
    emitEvent: (event) => {
      events.push(event);
    },
    readConfig: () => ({
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 1000,
      writeback: {
        enabled: true,
        operatorPrivateKey: `0x${"1".repeat(64)}`,
        chainId: 31337
      }
    }),
    createPersistentState: () => state.instance,
    createRuntime: () => ({
      deduper: {
        claim: () => true,
        has: () => false
      },
      getLatestBlockNumber: async () => 200,
      pollAuditRequestedLogs: async () => [],
      processAuditRequested: async () => buildProcessed(),
      writeAuditResult: async () => undefined,
      readLatestAuditReport: async () => {
        throw new Error("not used");
      },
      submitRetryWriteback: async () => {
        throw new Error("not used");
      }
    }),
    flushRetryQueue: async () => {
      sequence.push("flush");
      return [
        {
          eventKey: "0xretry:1",
          outcome: "reconciled",
          tokenId: "1"
        }
      ];
    },
    runListenerOnce: async () => {
      sequence.push("poll");
      return {
        processed: [],
        latestBlockNumber: 200,
        nextBlock: 201
      };
    }
  });

  assert.deepEqual(sequence, ["flush", "poll"]);
  assert.ok(events.some((event) => event.type === "writeback-retry-reconciled"));
});

test("runListenerCli fails before polling when the service lock cannot be acquired", async () => {
  let polled = false;

  await assert.rejects(
    runListenerCli([], process.env, {
      readConfig: () => ({
        rpcUrl: "https://rpc.edge.local",
        contractAddress: "0x1111111111111111111111111111111111111111",
        stateDir: "/tmp/listener-state",
        pollIntervalMs: 1000,
        writeback: { enabled: false }
      }),
      createPersistentState: () => createState({ cursor: 200 }).instance,
      createServiceState: () => ({
        stateDir: "/tmp/listener-state",
        acquireLock: async () => {
          throw new Error("listener state directory is already locked");
        },
        writeStatus: async () => undefined,
        releaseLock: async () => undefined
      }),
      createRuntime: () => ({
        deduper: {
          claim: () => true,
          has: () => false
        },
        getLatestBlockNumber: async () => 200,
        pollAuditRequestedLogs: async () => [],
        processAuditRequested: async () => buildProcessed()
      }),
      runListenerOnce: async () => {
        polled = true;
        return {
          processed: [],
          latestBlockNumber: 200,
          nextBlock: 201
        };
      }
    }),
    /already locked/i
  );

  assert.equal(polled, false);
});

test("runListenerCli writes service lifecycle events and stops gracefully after a signal", async () => {
  const state = createState({ cursor: 200 });
  const events: Array<Record<string, unknown>> = [];
  const statuses: Array<Record<string, unknown>> = [];
  const sleeps: number[] = [];
  let signalHandler: ((signal: NodeJS.Signals) => void) | undefined;
  let released = false;
  let unregisterCalled = false;
  let pollCount = 0;

  await runListenerCli([], process.env, {
    now: (() => {
      const timestamps = [
        "2026-03-27T12:00:00.000Z",
        "2026-03-27T12:00:01.000Z",
        "2026-03-27T12:00:02.000Z",
        "2026-03-27T12:00:03.000Z",
        "2026-03-27T12:00:04.000Z"
      ];
      let index = 0;
      return () => new Date(timestamps[Math.min(index++, timestamps.length - 1)] as string);
    })(),
    emitEvent: (event) => {
      events.push(event);
    },
    readConfig: () => ({
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 1000,
      writeback: { enabled: false }
    }),
    createPersistentState: () => state.instance,
    createServiceState: () => ({
      stateDir: "/tmp/listener-state",
      acquireLock: async () => undefined,
      writeStatus: async (status: ListenerServiceStatus) => {
        statuses.push(status as unknown as Record<string, unknown>);
      },
      releaseLock: async () => {
        released = true;
      }
    }),
    registerSignalHandlers: (onSignal: (signal: NodeJS.Signals) => void) => {
      signalHandler = onSignal;
      return () => {
        unregisterCalled = true;
      };
    },
    createRuntime: () => ({
      deduper: {
        claim: () => true,
        has: () => false
      },
      getLatestBlockNumber: async () => 200,
      pollAuditRequestedLogs: async () => [],
      processAuditRequested: async () => buildProcessed()
    }),
    flushRetryQueue: async () => [],
    runListenerOnce: async () => {
      pollCount += 1;
      return {
        processed: [],
        latestBlockNumber: 200,
        nextBlock: 201
      };
    },
    sleep: async (ms) => {
      sleeps.push(ms);
      signalHandler?.("SIGTERM");
    }
  });

  assert.equal(pollCount, 1);
  assert.deepEqual(sleeps, [1000]);
  assert.equal(released, true);
  assert.equal(unregisterCalled, true);
  assert.ok(events.some((event) => event.type === "listener-service-started"));
  assert.ok(events.some((event) => event.type === "listener-service-heartbeat"));
  assert.ok(events.some((event) => event.type === "listener-stop-requested" && event.signal === "SIGTERM"));
  assert.ok(events.some((event) => event.type === "listener-service-stopped" && event.signal === "SIGTERM"));
  assert.ok(statuses.some((status) => status.state === "starting"));
  assert.ok(statuses.some((status) => status.state === "running" && status.nextBlock === 201));
  assert.ok(statuses.some((status) => status.state === "stopped" && status.lastSignal === "SIGTERM"));
});

test("runListenerCli records observed task events into the task status store", async () => {
  const state = createState({ cursor: 123 });
  const processed = buildProcessed();
  const recordedEvents: Array<Record<string, unknown>> = [];

  await runListenerCli(["--once"], process.env, {
    emitEvent: async () => undefined,
    readConfig: () => ({
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 1000,
      writeback: {
        enabled: true,
        operatorPrivateKey: `0x${"1".repeat(64)}`,
        chainId: 31337
      }
    }),
    createPersistentState: () => state.instance,
    createTaskStatusState: () => ({
      stateDir: "/tmp/listener-state",
      recordEvent: async (event: Record<string, unknown>) => {
        recordedEvents.push(event);
      },
      readTaskStatuses: async () => []
    }),
    createRuntime: () => ({
      deduper: {
        claim: () => true,
        has: () => false
      },
      getLatestBlockNumber: async () => 123,
      pollAuditRequestedLogs: async () => [processed.event],
      processAuditRequested: async () => processed,
      writeAuditResult: async () => ({
        transactionHash: "0xwriteback",
        blockNumber: 130
      }),
      readLatestAuditReport: async () => {
        throw new Error("not used");
      },
      submitRetryWriteback: async () => {
        throw new Error("not used");
      }
    }),
    flushRetryQueue: async () => [],
    runListenerOnce: async ({ emitLifecycleEvent, writeAuditResult }) => {
      emitLifecycleEvent?.({
        type: "listener-task-received",
        eventKey: processed.event.eventKey,
        tokenId: processed.event.tokenId.toString(),
        agentName: processed.event.agentName,
        manifestUrl: processed.event.manifestUrl,
        blockNumber: processed.event.blockNumber,
        transactionHash: processed.event.transactionHash
      });
      emitLifecycleEvent?.({
        type: "listener-task-processed",
        eventKey: processed.event.eventKey,
        tokenId: processed.event.tokenId.toString(),
        agentName: processed.event.agentName,
        manifestUrl: processed.event.manifestUrl,
        blockNumber: processed.event.blockNumber,
        transactionHash: processed.event.transactionHash,
        auditStatus: processed.writeback.status,
        auditScore: processed.writeback.auditScore,
        reasonCode: processed.auditResult.reasonCode ?? null
      });
      await writeAuditResult?.(processed);
      return {
        processed: [processed],
        latestBlockNumber: 123,
        nextBlock: 124
      };
    }
  });

  assert.ok(recordedEvents.some((event) => event.type === "listener-task-received"));
  assert.ok(recordedEvents.some((event) => event.type === "listener-task-processed"));
  assert.ok(recordedEvents.some((event) => event.type === "writeback-submitting"));
  assert.ok(recordedEvents.some((event) => event.type === "writeback-confirmed"));
});

test("runListenerCli queues retryable audit execution failures instead of writing them back immediately", async () => {
  const state = createState({ cursor: 123 });
  const processed = buildProcessed(
    buildEvent(),
    buildAuditResult({
      status: "failed",
      reasonCode: "REQUEST_TIMEOUT",
      answer: "",
      actions: [],
      requestCount: 0,
      requestedIps: [],
      requestedHosts: []
    })
  );
  (processed as { reportStorage?: unknown }).reportStorage = {
    outcome: "failed",
    error: "Error: ipfs unavailable",
    originalAuditStatus: "failed",
    originalAuditReasonCode: "REQUEST_TIMEOUT"
  };
  const events: Array<Record<string, unknown>> = [];
  let baseWritebackCalled = false;

  await runListenerCli(["--once"], process.env, {
    now: () => new Date("2026-03-28T10:00:00.000Z"),
    emitEvent: (event) => {
      events.push(event);
    },
    readConfig: () => ({
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 1000,
      writeback: {
        enabled: true,
        operatorPrivateKey: `0x${"1".repeat(64)}`,
        chainId: 31337
      }
    }),
    createPersistentState: () => state.instance,
    createRuntime: () => ({
      deduper: {
        claim: () => true,
        has: () => false
      },
      getLatestBlockNumber: async () => 123,
      pollAuditRequestedLogs: async () => [processed.event],
      processAuditRequested: async () => processed,
      writeAuditResult: async () => {
        baseWritebackCalled = true;
      },
      readLatestAuditReport: async () => {
        throw new Error("not used");
      },
      submitRetryWriteback: async () => {
        throw new Error("not used");
      }
    }),
    flushRetryQueue: async () => [],
    runListenerOnce: async ({ emitLifecycleEvent, writeAuditResult }) => {
      await emitLifecycleEvent?.({
        type: "listener-task-processed",
        eventKey: processed.event.eventKey,
        tokenId: processed.event.tokenId.toString(),
        agentName: processed.event.agentName,
        manifestUrl: processed.event.manifestUrl,
        blockNumber: processed.event.blockNumber,
        transactionHash: processed.event.transactionHash,
        auditStatus: processed.writeback.status,
        auditScore: processed.writeback.auditScore,
        reasonCode: processed.auditResult.reasonCode ?? null
      });
      await writeAuditResult?.(processed);
      return {
        processed: [processed],
        latestBlockNumber: 123,
        nextBlock: 124
      };
    }
  });

  assert.equal(baseWritebackCalled, false);
  assert.equal(state.auditExecutionQueued.length, 1);
  assert.equal(state.auditExecutionQueued[0]?.lastReasonCode, "REQUEST_TIMEOUT");
  assert.ok(events.some((event) => event.type === "audit-execution-retry-queued"));
  assert.ok(
    events.some(
      (event) =>
        event.type === "audit-execution-retry-queued" &&
        event.reportCID === "" &&
        event.reportStorageOutcome === "failed" &&
        event.reportStorageError === "Error: ipfs unavailable" &&
        event.originalAuditReasonCode === "REQUEST_TIMEOUT"
    )
  );
});

test("runListenerCli flushes queued audit execution retries before writeback retries and new polling", async () => {
  const state = createState({ cursor: 200 });
  const sequence: string[] = [];

  await runListenerCli(["--once"], process.env, {
    readConfig: () => ({
      rpcUrl: "https://rpc.edge.local",
      contractAddress: "0x1111111111111111111111111111111111111111",
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 1000,
      writeback: { enabled: false }
    }),
    createPersistentState: () => state.instance,
    createRuntime: () => ({
      deduper: {
        claim: () => true,
        has: () => false
      },
      getLatestBlockNumber: async () => 200,
      pollAuditRequestedLogs: async () => [],
      processAuditRequested: async () => buildProcessed()
    }),
    flushAuditExecutionQueue: async () => {
      sequence.push("auditExecutionFlush");
      return [];
    },
    flushRetryQueue: async () => {
      sequence.push("writebackFlush");
      return [];
    },
    runListenerOnce: async () => {
      sequence.push("poll");
      return {
        processed: [],
        latestBlockNumber: 200,
        nextBlock: 201
      };
    }
  });

  assert.deepEqual(sequence, ["auditExecutionFlush", "poll"]);
});

test("runListenerCli slashes the full bond after a confirmed writeback for hard redline signals", async () => {
  const state = createState({ cursor: 123 });
  const processed = buildProcessed(
    buildEvent(),
    buildAuditResult({
      status: "failed",
      reasonCode: "ACTION_MISMATCH",
      decisionType: "redline_violation",
      answer: "",
      actions: [],
      requestCount: 0,
      requestedIps: [],
      requestedHosts: []
    })
  );
  const slashCalls: WriteSlashBondRequest[] = [];
  const events: Array<Record<string, unknown>> = [];

  await runListenerCli(["--once"], process.env, {
    emitEvent: (event) => {
      events.push(event);
    },
    readConfig: () => ({
      rpcUrl: "https://rpc.edge.local",
      contractAddress: CONTRACT_ADDRESS,
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 1000,
      writeback: {
        enabled: true,
        operatorPrivateKey: `0x${"1".repeat(64)}`,
        chainId: 31337
      }
    }),
    createPersistentState: () => state.instance,
    createRuntime: () => ({
      deduper: {
        claim: () => true,
        has: () => false
      },
      getLatestBlockNumber: async () => 123,
      pollAuditRequestedLogs: async () => [processed.event],
      processAuditRequested: async () => processed,
      writeAuditResult: async () => buildAuditRecordedReceipt(processed.event.tokenId, 2),
      readAgentProfile: async () => ({
        developer: processed.event.developer,
        agentName: processed.event.agentName,
        tokenId: processed.event.tokenId,
        totalBond: 1000000000000000000n,
        blacklisted: false,
        createdAt: 1774536000,
        lastAuditAt: 1774536086,
        auditCount: 2
      }),
      readAuditReportByIndex: async () => {
        throw new Error("not used");
      },
      submitSlashBond: async (request: WriteSlashBondRequest) => {
        slashCalls.push(request);
        return { transactionHash: "0xslash", blockNumber: 131 };
      },
      readLatestAuditReport: async () => {
        throw new Error("not used");
      },
      submitRetryWriteback: async () => {
        throw new Error("not used");
      }
    }),
    flushSlashQueue: async () => [],
    flushRetryQueue: async () => [],
    runListenerOnce: async ({ writeAuditResult }) => {
      await writeAuditResult?.(processed);
      return {
        processed: [processed],
        latestBlockNumber: 123,
        nextBlock: 124
      };
    }
  });

  assert.deepEqual(slashCalls, [
    {
      tokenId: 1n,
      auditId: 2,
      amount: 1000000000000000000n,
      reasonCode: "ACTION_MISMATCH"
    }
  ]);
  assert.equal(state.slashQueued.length, 0);
  const writebackConfirmedIndex = events.findIndex((event) => event.type === "writeback-confirmed");
  const slashSubmittingIndex = events.findIndex((event) => event.type === "slash-submitting");
  assert.ok(writebackConfirmedIndex >= 0);
  assert.ok(slashSubmittingIndex > writebackConfirmedIndex);
  assert.ok(events.some((event) => event.type === "slash-confirmed" && event.auditId === 2));
});

test("runListenerCli does not slash when decisionType alone is redline_violation", async () => {
  const state = createState({ cursor: 123 });
  const processed = buildProcessed(
    buildEvent(),
    buildAuditResult({
      decisionType: "redline_violation",
      reasonCode: undefined
    })
  );
  let readAgentProfileCalled = false;
  let submitSlashBondCalled = false;
  const events: Array<Record<string, unknown>> = [];

  await runListenerCli(["--once"], process.env, {
    emitEvent: (event) => {
      events.push(event);
    },
    readConfig: () => ({
      rpcUrl: "https://rpc.edge.local",
      contractAddress: CONTRACT_ADDRESS,
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 1000,
      writeback: {
        enabled: true,
        operatorPrivateKey: `0x${"1".repeat(64)}`,
        chainId: 31337
      }
    }),
    createPersistentState: () => state.instance,
    createRuntime: () => ({
      deduper: {
        claim: () => true,
        has: () => false
      },
      getLatestBlockNumber: async () => 123,
      pollAuditRequestedLogs: async () => [processed.event],
      processAuditRequested: async () => processed,
      writeAuditResult: async () => buildAuditRecordedReceipt(processed.event.tokenId, 2),
      readAgentProfile: async () => {
        readAgentProfileCalled = true;
        throw new Error("not used");
      },
      readAuditReportByIndex: async () => {
        throw new Error("not used");
      },
      submitSlashBond: async () => {
        submitSlashBondCalled = true;
        throw new Error("not used");
      },
      readLatestAuditReport: async () => {
        throw new Error("not used");
      },
      submitRetryWriteback: async () => {
        throw new Error("not used");
      }
    }),
    flushSlashQueue: async () => [],
    flushRetryQueue: async () => [],
    runListenerOnce: async ({ writeAuditResult }) => {
      await writeAuditResult?.(processed);
      return {
        processed: [processed],
        latestBlockNumber: 123,
        nextBlock: 124
      };
    }
  });

  assert.equal(readAgentProfileCalled, false);
  assert.equal(submitSlashBondCalled, false);
  assert.ok(events.every((event) => !String(event.type).startsWith("slash-")));
});

test("runListenerCli queues durable slash retry state when slashBond fails after writeback confirmation", async () => {
  const state = createState({ cursor: 123 });
  const processed = buildProcessed(
    buildEvent(),
    buildAuditResult({
      status: "failed",
      reasonCode: "UNDECLARED_EGRESS",
      decisionType: "redline_violation",
      answer: "",
      actions: [],
      requestCount: 0,
      requestedIps: [],
      requestedHosts: []
    })
  );
  const events: Array<Record<string, unknown>> = [];

  await runListenerCli(["--once"], process.env, {
    now: () => new Date("2026-03-30T10:00:00.000Z"),
    emitEvent: (event) => {
      events.push(event);
    },
    readConfig: () => ({
      rpcUrl: "https://rpc.edge.local",
      contractAddress: CONTRACT_ADDRESS,
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 1000,
      writeback: {
        enabled: true,
        operatorPrivateKey: `0x${"1".repeat(64)}`,
        chainId: 31337
      }
    }),
    createPersistentState: () => state.instance,
    createRuntime: () => ({
      deduper: {
        claim: () => true,
        has: () => false
      },
      getLatestBlockNumber: async () => 123,
      pollAuditRequestedLogs: async () => [processed.event],
      processAuditRequested: async () => processed,
      writeAuditResult: async () => buildAuditRecordedReceipt(processed.event.tokenId, 4),
      readAgentProfile: async () => ({
        developer: processed.event.developer,
        agentName: processed.event.agentName,
        tokenId: processed.event.tokenId,
        totalBond: 500000000000000000n,
        blacklisted: false,
        createdAt: 1774536000,
        lastAuditAt: 1774536086,
        auditCount: 4
      }),
      readAuditReportByIndex: async () => {
        throw new Error("not used");
      },
      submitSlashBond: async () => {
        throw new Error("slash send failed");
      },
      readLatestAuditReport: async () => {
        throw new Error("not used");
      },
      submitRetryWriteback: async () => {
        throw new Error("not used");
      }
    }),
    flushSlashQueue: async () => [],
    flushRetryQueue: async () => [],
    runListenerOnce: async ({ writeAuditResult }) => {
      await writeAuditResult?.(processed);
      return {
        processed: [processed],
        latestBlockNumber: 123,
        nextBlock: 124
      };
    }
  });

  assert.equal(state.slashQueued.length, 1);
  assert.deepEqual(state.slashQueued[0], {
    eventKey: "0xabc:0",
    state: "pending",
    tokenId: "1",
    auditId: 4,
    slashAmount: "500000000000000000",
    reasonCode: "UNDECLARED_EGRESS",
    attemptCount: 1,
    lastAttemptAt: "2026-03-30T10:00:00.000Z",
    nextAttemptAt: "2026-03-30T10:00:10.000Z",
    lastError: "Error: slash send failed"
  });
  assert.ok(events.some((event) => event.type === "slash-failed"));
  assert.ok(events.some((event) => event.type === "slash-retry-queued" && event.auditId === 4));
});

test("runListenerCli flushes queued slash retries before writeback retries and new polling", async () => {
  const state = createState({ cursor: 200 });
  const sequence: string[] = [];
  const events: Array<Record<string, unknown>> = [];

  await runListenerCli(["--once"], process.env, {
    emitEvent: (event) => {
      events.push(event);
    },
    readConfig: () => ({
      rpcUrl: "https://rpc.edge.local",
      contractAddress: CONTRACT_ADDRESS,
      stateDir: "/tmp/listener-state",
      pollIntervalMs: 1000,
      writeback: {
        enabled: true,
        operatorPrivateKey: `0x${"1".repeat(64)}`,
        chainId: 31337
      }
    }),
    createPersistentState: () => state.instance,
    createRuntime: () => ({
      deduper: {
        claim: () => true,
        has: () => false
      },
      getLatestBlockNumber: async () => 200,
      pollAuditRequestedLogs: async () => [],
      processAuditRequested: async () => buildProcessed(),
      readAgentProfile: async () => {
        throw new Error("not used");
      },
      readAuditReportByIndex: async () => {
        throw new Error("not used");
      },
      submitSlashBond: async () => {
        throw new Error("not used");
      },
      readLatestAuditReport: async () => {
        throw new Error("not used");
      },
      submitRetryWriteback: async () => {
        throw new Error("not used");
      },
      writeAuditResult: async () => undefined
    }),
    flushAuditExecutionQueue: async () => {
      sequence.push("auditExecutionFlush");
      return [];
    },
    flushSlashQueue: async () => {
      sequence.push("slashFlush");
      return [
        {
          eventKey: "0xslash:1",
          outcome: "reconciled",
          tokenId: "1",
          auditId: 2
        }
      ];
    },
    flushRetryQueue: async () => {
      sequence.push("writebackFlush");
      return [];
    },
    runListenerOnce: async () => {
      sequence.push("poll");
      return {
        processed: [],
        latestBlockNumber: 200,
        nextBlock: 201
      };
    }
  });

  assert.deepEqual(sequence, ["auditExecutionFlush", "slashFlush", "writebackFlush", "poll"]);
  assert.ok(events.some((event) => event.type === "slash-retry-reconciled" && event.auditId === 2));
});
