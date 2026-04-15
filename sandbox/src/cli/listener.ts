import {
  createListenerRuntime,
  readListenerRuntimeConfigFromEnv,
  type ListenerRuntimeConfig
} from "../listener/createListenerRuntime";
import {
  createPersistentListenerState,
  type PersistentListenerState
} from "../listener/persistentListenerState";
import {
  createListenerServiceState,
  type ListenerServiceStatus
} from "../listener/listenerServiceState";
import {
  createListenerTaskStatusState,
  type ListenerTaskStatusState,
  type ListenerTaskStatusRecord
} from "../listener/listenerTaskStatusState";
import {
  createRetryQueueItem,
  flushRetryWritebackQueue,
  type RetryWritebackResult
} from "../listener/retryWritebackQueue";
import {
  createAuditExecutionRetryItem,
  flushAuditExecutionRetryQueue,
  isRetryableAuditExecutionFailure,
  type RetryAuditExecutionResult
} from "../listener/retryAuditExecutionQueue";
import {
  createSlashRetryItem,
  flushSlashRetryQueue,
  type RetrySlashResult
} from "../listener/retrySlashQueue";
import {
  runAuditRequestedListenerOnce,
  type RunAuditRequestedListenerDependencies,
  type RunAuditRequestedListenerOnceResult
} from "../listener/runAuditRequestedListener";
import { selectSlashReasonCode } from "../listener/slashPolicy";
import type {
  AuditRequestedEvent,
  ListenerAuditExecutionRetryItem,
  ListenerSlashRetryItem,
  ListenerRetryQueueItem,
  ProcessedAuditRequested
} from "../listener/types";
import type { AgentProfileOnChain } from "../listener/readAgentProfile";
import type { AuditReportByIndex } from "../listener/readAuditReportByIndex";
import type { LatestAuditReport } from "../listener/readLatestAuditReport";
import type { WriteSlashBondRequest } from "../listener/writeSlashBond";
import { getAuditRegistryInterface } from "../listener/auditRegistryArtifact";

interface WritebackReceiptLike {
  transactionHash: string;
  blockNumber?: number;
  logs?: Array<{
    address: string;
    data: `0x${string}`;
    topics: `0x${string}`[];
  }>;
}

interface ListenerRuntimeLike extends RunAuditRequestedListenerDependencies {
  getLatestBlockNumber: () => Promise<number>;
  readLatestAuditReport?: (tokenId: bigint) => Promise<LatestAuditReport>;
  readAgentProfile?: (tokenId: bigint) => Promise<AgentProfileOnChain>;
  readAuditReportByIndex?: (tokenId: bigint, index: number) => Promise<AuditReportByIndex>;
  submitSlashBond?: (request: WriteSlashBondRequest) => Promise<unknown>;
  submitRetryWriteback?: (item: ListenerRetryQueueItem) => Promise<unknown>;
}

interface ListenerStateLike {
  stateDir: string;
  readCursor(): Promise<number | undefined>;
  writeCursor(nextBlock: number): Promise<void>;
  readRetryQueue(): Promise<ListenerRetryQueueItem[]>;
  enqueueRetry(item: ListenerRetryQueueItem): Promise<void>;
  upsertRetry(item: ListenerRetryQueueItem): Promise<void>;
  removeRetry(eventKey: string): Promise<void>;
  readAuditExecutionRetryQueue(): Promise<ListenerAuditExecutionRetryItem[]>;
  enqueueAuditExecutionRetry(item: ListenerAuditExecutionRetryItem): Promise<void>;
  upsertAuditExecutionRetry(item: ListenerAuditExecutionRetryItem): Promise<void>;
  removeAuditExecutionRetry(eventKey: string): Promise<void>;
  readSlashRetryQueue(): Promise<ListenerSlashRetryItem[]>;
  enqueueSlashRetry(item: ListenerSlashRetryItem): Promise<void>;
  upsertSlashRetry(item: ListenerSlashRetryItem): Promise<void>;
  removeSlashRetry(eventKey: string): Promise<void>;
}

interface ListenerServiceStateLike {
  stateDir: string;
  acquireLock(metadata: { pid: number; startedAt: string }): Promise<void>;
  writeStatus(status: ListenerServiceStatus): Promise<void>;
  releaseLock(): Promise<void>;
}

interface ListenerTaskStatusStateLike {
  stateDir: string;
  readTaskStatuses(): Promise<ListenerTaskStatusRecord[]>;
  recordEvent(event: Record<string, unknown>): Promise<void>;
}

export interface ListenerCliDependencies {
  readConfig?: (
    env: NodeJS.ProcessEnv | Record<string, string | undefined>
  ) => ListenerRuntimeConfig;
  createRuntime?: (config: ListenerRuntimeConfig) => ListenerRuntimeLike;
  createPersistentState?: (options: { stateDir: string }) => ListenerStateLike;
  createServiceState?: (options: { stateDir: string }) => ListenerServiceStateLike;
  createTaskStatusState?: (options: { stateDir: string }) => ListenerTaskStatusStateLike;
  flushAuditExecutionQueue?: (options: {
    state: Pick<
      ListenerStateLike,
      "readAuditExecutionRetryQueue" | "upsertAuditExecutionRetry" | "removeAuditExecutionRetry"
    >;
    processAuditRequested: (event: AuditRequestedEvent) => Promise<ProcessedAuditRequested>;
    now?: () => Date;
  }) => Promise<RetryAuditExecutionResult[]>;
  flushRetryQueue?: (options: {
    state: ListenerStateLike;
    readLatestAuditReport: (tokenId: bigint) => Promise<LatestAuditReport>;
    submitWriteback: (item: ListenerRetryQueueItem) => Promise<WritebackReceiptLike>;
    now?: () => Date;
  }) => Promise<RetryWritebackResult[]>;
  flushSlashQueue?: (options: {
    state: Pick<
      ListenerStateLike,
      "readSlashRetryQueue" | "upsertSlashRetry" | "removeSlashRetry"
    >;
    readAuditReportByIndex: (tokenId: bigint, index: number) => Promise<AuditReportByIndex>;
    submitSlashBond: (
      request: WriteSlashBondRequest
    ) => Promise<{ transactionHash: `0x${string}`; blockNumber?: number }>;
    now?: () => Date;
  }) => Promise<RetrySlashResult[]>;
  runListenerOnce?: (
    options: { fromBlock: number } & RunAuditRequestedListenerDependencies
  ) => Promise<RunAuditRequestedListenerOnceResult>;
  sleep?: (ms: number) => Promise<void>;
  emitEvent?: (event: Record<string, unknown>) => void;
  registerSignalHandlers?: (onSignal: (signal: NodeJS.Signals) => void) => () => void;
  now?: () => Date;
  pid?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emitListenerEvent(event: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(event, null, 2)}\n`);
}

function registerProcessSignalHandlers(onSignal: (signal: NodeJS.Signals) => void): () => void {
  const listeners: Array<{
    signal: NodeJS.Signals;
    handler: () => void;
  }> = [];

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    const handler = (): void => {
      onSignal(signal);
    };

    listeners.push({ signal, handler });
    process.on(signal, handler);
  }

  return (): void => {
    for (const listener of listeners) {
      process.off(listener.signal, listener.handler);
    }
  };
}

function toWritebackReceiptLike(value: unknown): WritebackReceiptLike | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const { transactionHash, blockNumber } = value as {
    transactionHash?: unknown;
    blockNumber?: unknown;
    logs?: unknown;
  };

  if (typeof transactionHash !== "string") {
    return undefined;
  }

  return {
    transactionHash,
    blockNumber: typeof blockNumber === "number" ? blockNumber : undefined,
    logs: Array.isArray((value as { logs?: unknown[] }).logs)
      ? ((value as { logs: Array<{ address: string; data: `0x${string}`; topics: `0x${string}`[] }> }).logs)
      : undefined
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

function buildWritebackEventBase(processed: ProcessedAuditRequested): Record<string, unknown> {
  const reportStorage = processed.reportStorage;

  return {
    eventKey: processed.event.eventKey,
    tokenId: processed.writeback.tokenId.toString(),
    agentName: processed.event.agentName,
    auditStatus: processed.writeback.status,
    auditScore: processed.writeback.auditScore,
    manifestHash: processed.writeback.manifestHash,
    reportHash: processed.writeback.reportHash,
    reportCID: processed.writeback.reportCID,
    manifestUrl: processed.writeback.manifestUrl,
    reportFilePath: processed.reportPersistence.reportFilePath,
    reportStorageOutcome: reportStorage?.outcome ?? "skipped",
    reportStorageCosObjectKey: reportStorage?.cosObjectKey ?? null,
    reportStorageError: reportStorage?.error ?? null,
    originalAuditStatus: reportStorage?.originalAuditStatus ?? null,
    originalAuditReasonCode: reportStorage?.originalAuditReasonCode ?? null,
    blockNumber: processed.event.blockNumber,
    transactionHash: processed.event.transactionHash
  };
}

function buildAuditExecutionRetryEventBase(processed: ProcessedAuditRequested): Record<string, unknown> {
  const reportStorage = processed.reportStorage;

  return {
    eventKey: processed.event.eventKey,
    tokenId: processed.event.tokenId.toString(),
    agentName: processed.event.agentName,
    manifestUrl: processed.event.manifestUrl,
    blockNumber: processed.event.blockNumber,
    transactionHash: processed.event.transactionHash,
    reasonCode: processed.auditResult.reasonCode ?? null,
    reportCID: processed.writeback.reportCID,
    reportFilePath: processed.reportPersistence.reportFilePath,
    reportStorageOutcome: reportStorage?.outcome ?? "skipped",
    reportStorageCosObjectKey: reportStorage?.cosObjectKey ?? null,
    reportStorageError: reportStorage?.error ?? null,
    originalAuditStatus: reportStorage?.originalAuditStatus ?? null,
    originalAuditReasonCode: reportStorage?.originalAuditReasonCode ?? null
  };
}

async function emitAuditExecutionRetryResult(
  emitEvent: (event: Record<string, unknown>) => Promise<void>,
  result: RetryAuditExecutionResult
): Promise<void> {
  if (result.outcome === "completed") {
    const eventBase = result.processed
      ? buildWritebackEventBase(result.processed)
      : {
          eventKey: result.eventKey,
          tokenId: result.tokenId
        };

    await emitEvent({
      type: "audit-execution-retry-completed",
      ...eventBase,
      auditStatus: result.processed?.writeback.status,
      auditScore: result.processed?.writeback.auditScore,
      reasonCode: result.processed?.auditResult.reasonCode ?? null,
      agentName: result.processed?.event.agentName,
      manifestUrl: result.processed?.event.manifestUrl,
      blockNumber: result.processed?.event.blockNumber,
      transactionHash: result.processed?.event.transactionHash
    });
    return;
  }

  await emitEvent({
    type: "audit-execution-retry-queued",
    eventKey: result.eventKey,
    tokenId: result.tokenId,
    attemptCount: result.attemptCount,
    nextAttemptAt: result.nextAttemptAt,
    reasonCode: result.reasonCode ?? null,
    error: result.error
  });
}

function emitSlashRetryResult(
  emitEvent: (event: Record<string, unknown>) => Promise<void>,
  result: RetrySlashResult
): Promise<void> {
  const eventBase = {
    eventKey: result.eventKey,
    tokenId: result.tokenId,
    auditId: result.auditId
  };

  if (result.outcome === "reconciled") {
    return emitEvent({
      type: "slash-retry-reconciled",
      ...eventBase
    });
  }

  if (result.outcome === "confirmed") {
    return emitEvent({
      type: "slash-retry-confirmed",
      ...eventBase,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber ?? null
    });
  }

  return emitEvent({
    type: "slash-retry-queued",
    ...eventBase,
    attemptCount: result.attemptCount,
    nextAttemptAt: result.nextAttemptAt,
    error: result.error
  });
}

function decodeAuditRecordedAuditId(receipt: WritebackReceiptLike): number {
  for (const log of receipt.logs ?? []) {
    try {
      const parsed = getAuditRegistryInterface().parseLog({
        data: log.data,
        topics: log.topics
      });

      if (parsed.name === "AuditRecorded") {
        return Number(parsed.args.auditId.toString());
      }
    } catch {
      continue;
    }
  }

  throw new Error("writeback receipt did not include an AuditRecorded log");
}

function emitRetryResult(
  emitEvent: (event: Record<string, unknown>) => Promise<void>,
  result: RetryWritebackResult
): Promise<void> {
  const eventBase = {
    eventKey: result.eventKey,
    tokenId: result.tokenId
  };

  if (result.outcome === "reconciled") {
    return emitEvent({
      type: "writeback-retry-reconciled",
      ...eventBase
    });
  }

  if (result.outcome === "confirmed") {
    return emitEvent({
      type: "writeback-retry-confirmed",
      ...eventBase,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber ?? null
    });
  }

  if (result.outcome === "conflict") {
    return emitEvent({
      type: "writeback-retry-conflict",
      ...eventBase,
      state: result.state,
      error: result.error
    });
  }

  return emitEvent({
    type: "writeback-retry-queued",
    ...eventBase,
    attemptCount: result.attemptCount,
    nextAttemptAt: result.nextAttemptAt,
    error: result.error
  });
}

function createObservedWriteAuditResult(
  baseWriteAuditResult: NonNullable<RunAuditRequestedListenerDependencies["writeAuditResult"]>,
  options: {
    writebackEnabled: boolean;
    emitEvent: (event: Record<string, unknown>) => Promise<void>;
    enqueueAuditExecutionRetry: (item: ListenerAuditExecutionRetryItem) => Promise<void>;
    enqueueRetry: (item: ListenerRetryQueueItem) => Promise<void>;
    enqueueSlashRetry: (item: ListenerSlashRetryItem) => Promise<void>;
    readAgentProfile?: (tokenId: bigint) => Promise<AgentProfileOnChain>;
    submitSlashBond?: (request: WriteSlashBondRequest) => Promise<unknown>;
    now: () => Date;
  }
): RunAuditRequestedListenerDependencies["writeAuditResult"] {
  return async (processed): Promise<void> => {
    const writebackEvent = buildWritebackEventBase(processed);

    if (isRetryableAuditExecutionFailure(processed)) {
      const retryItem = createAuditExecutionRetryItem(processed, options.now());
      await options.enqueueAuditExecutionRetry(retryItem);
      await options.emitEvent({
        type: "audit-execution-retry-queued",
        ...buildAuditExecutionRetryEventBase(processed),
        attemptCount: retryItem.attemptCount,
        nextAttemptAt: retryItem.nextAttemptAt,
        error: retryItem.lastError
      });
      return;
    }

    if (!options.writebackEnabled) {
      await options.emitEvent({
        type: "writeback-skipped",
        ...writebackEvent,
        reason: "AUDIT_WRITEBACK_ENABLED is not true"
      });
      await baseWriteAuditResult(processed);
      return;
    }

    await options.emitEvent({
      type: "writeback-submitting",
      ...writebackEvent
    });

    let receipt: WritebackReceiptLike;
    try {
      const writebackResult = (await baseWriteAuditResult(processed)) as unknown;
      const normalizedReceipt = toWritebackReceiptLike(writebackResult);

      if (!normalizedReceipt) {
        throw new Error("writeback result did not include a transaction receipt");
      }

      receipt = normalizedReceipt;

      await options.emitEvent({
        type: "writeback-confirmed",
        ...writebackEvent,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber ?? null
      });
    } catch (error) {
      const message = toErrorMessage(error);
      await options.emitEvent({
        type: "writeback-failed",
        ...writebackEvent,
        error: message
      });

      const retryItem = createRetryQueueItem(processed, error, options.now());
      await options.enqueueRetry(retryItem);

      await options.emitEvent({
        type: "writeback-retry-queued",
        ...writebackEvent,
        attemptCount: retryItem.attemptCount,
        nextAttemptAt: retryItem.nextAttemptAt,
        error: retryItem.lastError
      });
      return;
    }

    const slashReasonCode = selectSlashReasonCode(processed);
    if (!slashReasonCode) {
      return;
    }

    if (!options.readAgentProfile || !options.submitSlashBond) {
      throw new Error("slash helpers are not available");
    }

    const auditId = decodeAuditRecordedAuditId(receipt);
    const profile = await options.readAgentProfile(processed.event.tokenId);
    if (profile.totalBond <= 0n) {
      await options.emitEvent({
        type: "slash-skipped",
        ...writebackEvent,
        auditId,
        slashAmount: "0",
        reasonCode: slashReasonCode,
        reason: "agent bond is already zero"
      });
      return;
    }

    const slashRequest: WriteSlashBondRequest = {
      tokenId: processed.event.tokenId,
      auditId,
      amount: profile.totalBond,
      reasonCode: slashReasonCode
    };

    await options.emitEvent({
      type: "slash-submitting",
      ...writebackEvent,
      auditId,
      slashAmount: slashRequest.amount.toString(),
      reasonCode: slashRequest.reasonCode
    });

    try {
      const slashResult = await options.submitSlashBond(slashRequest);
      const slashReceipt = toWritebackReceiptLike(slashResult);

      await options.emitEvent({
        type: "slash-confirmed",
        ...writebackEvent,
        auditId,
        slashAmount: slashRequest.amount.toString(),
        reasonCode: slashRequest.reasonCode,
        transactionHash: slashReceipt?.transactionHash ?? null,
        blockNumber: slashReceipt?.blockNumber ?? null
      });
    } catch (slashError) {
      const message = toErrorMessage(slashError);
      await options.emitEvent({
        type: "slash-failed",
        ...writebackEvent,
        auditId,
        slashAmount: slashRequest.amount.toString(),
        reasonCode: slashRequest.reasonCode,
        error: message
      });

      const retryItem = createSlashRetryItem(
        {
          eventKey: processed.event.eventKey,
          tokenId: processed.event.tokenId,
          auditId,
          slashAmount: slashRequest.amount,
          reasonCode: slashReasonCode
        },
        slashError,
        options.now()
      );
      await options.enqueueSlashRetry(retryItem);
      await options.emitEvent({
        type: "slash-retry-queued",
        ...writebackEvent,
        auditId,
        slashAmount: slashRequest.amount.toString(),
        reasonCode: slashRequest.reasonCode,
        attemptCount: retryItem.attemptCount,
        nextAttemptAt: retryItem.nextAttemptAt,
        error: retryItem.lastError
      });
    }
  };
}

export async function resolveInitialFromBlock(
  config: ListenerRuntimeConfig,
  state: Pick<ListenerStateLike, "readCursor">,
  getLatestBlockNumber: () => Promise<number>
): Promise<{ fromBlock: number; source: "env" | "cursor" | "chain" }> {
  if (config.startBlock !== undefined) {
    return {
      fromBlock: config.startBlock,
      source: "env"
    };
  }

  const persistedCursor = await state.readCursor();
  if (persistedCursor !== undefined) {
    return {
      fromBlock: persistedCursor,
      source: "cursor"
    };
  }

  return {
    fromBlock: await getLatestBlockNumber(),
    source: "chain"
  };
}

export async function runListenerCli(
  argv: string[],
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  dependencies: ListenerCliDependencies = {}
): Promise<void> {
  const args = new Set(argv);
  const runOnce = args.has("--once");
  const baseEmitEvent = dependencies.emitEvent ?? emitListenerEvent;
  const now = dependencies.now ?? (() => new Date());
  const config = (dependencies.readConfig ?? readListenerRuntimeConfigFromEnv)(env);
  const stateDir = config.stateDir ?? process.cwd();
  const pid = dependencies.pid ?? process.pid;
  const state = (dependencies.createPersistentState ?? createPersistentListenerState)({
    stateDir
  });
  const serviceState = (dependencies.createServiceState ?? createListenerServiceState)({
    stateDir
  });
  const taskStatusState = (dependencies.createTaskStatusState ?? createListenerTaskStatusState)({
    stateDir
  });
  const runtime = (dependencies.createRuntime ?? createListenerRuntime)(config);
  const writebackEnabled = config.writeback?.enabled === true;
  const baseWriteAuditResult = runtime.writeAuditResult;
  const startedAt = now().toISOString();
  let stopRequested = false;
  let stopSignal: NodeJS.Signals | undefined;
  let finalState: ListenerServiceStatus["state"] = "stopped";
  let finalError: string | undefined;

  async function emitObservedTaskEvent(event: Record<string, unknown>): Promise<void> {
    await taskStatusState.recordEvent(event);
    baseEmitEvent(event);
  }

  await serviceState.acquireLock({
    pid,
    startedAt
  });
  await serviceState.writeStatus({
    pid,
    state: "starting",
    startedAt,
    updatedAt: startedAt
  });
  baseEmitEvent({
    type: "listener-service-started",
    pid,
    stateDir,
    writebackEnabled
  });

  const unregisterSignalHandlers = (
    dependencies.registerSignalHandlers ?? registerProcessSignalHandlers
  )((signal) => {
    if (stopRequested) {
      return;
    }

    stopRequested = true;
    stopSignal = signal;
    baseEmitEvent({
      type: "listener-stop-requested",
      pid,
      stateDir,
      signal
    });
  });

  if (baseWriteAuditResult) {
    runtime.writeAuditResult = createObservedWriteAuditResult(baseWriteAuditResult, {
      writebackEnabled,
      emitEvent: emitObservedTaskEvent,
      enqueueAuditExecutionRetry: (item) => state.enqueueAuditExecutionRetry(item),
      enqueueRetry: (item) => state.enqueueRetry(item),
      enqueueSlashRetry: (item) => state.enqueueSlashRetry(item),
      readAgentProfile: runtime.readAgentProfile,
      submitSlashBond: runtime.submitSlashBond,
      now
    });
  }

  let fromBlock: number | undefined;

  try {
    const resolved = await resolveInitialFromBlock(config, state, runtime.getLatestBlockNumber);
    if (resolved.source === "cursor") {
      baseEmitEvent({
        type: "listener-cursor-loaded",
        nextBlock: resolved.fromBlock,
        stateDir
      });
    }

    fromBlock = resolved.fromBlock;

    do {
      if (stopRequested) {
        break;
      }

      const auditExecutionRetryResults = await (
        dependencies.flushAuditExecutionQueue ?? flushAuditExecutionRetryQueue
      )({
        state: {
          readAuditExecutionRetryQueue: () => state.readAuditExecutionRetryQueue(),
          upsertAuditExecutionRetry: (item) => state.upsertAuditExecutionRetry(item),
          removeAuditExecutionRetry: (eventKey) => state.removeAuditExecutionRetry(eventKey)
        },
        processAuditRequested: runtime.processAuditRequested,
        now
      });

      for (const result of auditExecutionRetryResults) {
        await emitAuditExecutionRetryResult(emitObservedTaskEvent, result);

        if (result.outcome === "completed" && result.processed && runtime.writeAuditResult) {
          await runtime.writeAuditResult(result.processed);
        }
      }

      if (runtime.readAuditReportByIndex && runtime.submitSlashBond) {
        const slashRetryResults = await (dependencies.flushSlashQueue ?? flushSlashRetryQueue)({
          state: {
            readSlashRetryQueue: () => state.readSlashRetryQueue(),
            upsertSlashRetry: (item) => state.upsertSlashRetry(item),
            removeSlashRetry: (eventKey) => state.removeSlashRetry(eventKey)
          },
          readAuditReportByIndex: runtime.readAuditReportByIndex,
          submitSlashBond: async (request) => {
            const receipt = await runtime.submitSlashBond?.(request);
            const normalized = toWritebackReceiptLike(receipt);

            if (!normalized) {
              throw new Error("slash result did not include a transaction receipt");
            }

            return {
              transactionHash: normalized.transactionHash as `0x${string}`,
              blockNumber: normalized.blockNumber
            };
          },
          now
        });

        for (const result of slashRetryResults) {
          await emitSlashRetryResult(emitObservedTaskEvent, result);
        }
      }

      if (runtime.readLatestAuditReport && runtime.submitRetryWriteback) {
        const retryResults = await (dependencies.flushRetryQueue ?? flushRetryWritebackQueue)({
          state,
          readLatestAuditReport: runtime.readLatestAuditReport,
          submitWriteback: async (item) => {
            const receipt = await runtime.submitRetryWriteback?.(item);
            const normalized = toWritebackReceiptLike(receipt);

            if (!normalized) {
              throw new Error("retry writeback result did not include a transaction receipt");
            }

            return {
              transactionHash: normalized.transactionHash as `0x${string}`,
              blockNumber: normalized.blockNumber
            };
          },
          now
        });

        for (const result of retryResults) {
          await emitRetryResult(emitObservedTaskEvent, result);
        }
      }

      const result = await (dependencies.runListenerOnce ?? runAuditRequestedListenerOnce)({
        fromBlock,
        emitLifecycleEvent: emitObservedTaskEvent,
        ...runtime
      });

      baseEmitEvent({
        type: "listener-poll",
        fromBlock,
        latestBlockNumber: result.latestBlockNumber,
        processedCount: result.processed.length,
        processedEventKeys: result.processed.map((processed) => processed.event.eventKey),
        nextBlock: result.nextBlock,
        writebackEnabled
      });

      await state.writeCursor(result.nextBlock);
      baseEmitEvent({
        type: "listener-cursor-saved",
        nextBlock: result.nextBlock,
        stateDir
      });

      fromBlock = result.nextBlock;

      const heartbeatAt = now().toISOString();
      await serviceState.writeStatus({
        pid,
        state: "running",
        startedAt,
        updatedAt: heartbeatAt,
        lastSignal: stopSignal,
        lastPollAt: heartbeatAt,
        nextBlock: result.nextBlock
      });
      baseEmitEvent({
        type: "listener-service-heartbeat",
        pid,
        stateDir,
        nextBlock: result.nextBlock,
        lastPollAt: heartbeatAt
      });

      if (runOnce) {
        break;
      }

      await (dependencies.sleep ?? sleep)(config.pollIntervalMs);
    } while (true);
  } catch (error) {
    finalState = "failed";
    finalError = toErrorMessage(error);
    baseEmitEvent({
      type: "listener-service-failed",
      pid,
      stateDir,
      error: finalError
    });
    throw error;
  } finally {
    unregisterSignalHandlers();

    await serviceState.writeStatus({
      pid,
      state: finalState,
      startedAt,
      updatedAt: now().toISOString(),
      lastSignal: stopSignal,
      nextBlock: fromBlock,
      lastError: finalError
    });
    await serviceState.releaseLock();
    baseEmitEvent({
      type: "listener-service-stopped",
      pid,
      stateDir,
      signal: stopSignal ?? null,
      state: finalState,
      error: finalError ?? null
    });
  }
}

if (require.main === module) {
  void runListenerCli(process.argv.slice(2), process.env).catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
