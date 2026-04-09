import type { InMemoryEventDeduper } from "./inMemoryEventDeduper";
import type { SlashDecision } from "./slashPolicy";
import type { AuditRequestedEvent, ProcessedAuditRequested, SlashReasonCode } from "./types";

export type ListenerTaskLifecycleEvent =
  | {
      type: "listener-task-received" | "listener-task-started" | "listener-task-duplicate-skipped";
      eventKey: string;
      tokenId: string;
      agentName: string;
      manifestUrl: string;
      blockNumber: number;
      transactionHash: string;
    }
  | {
      type: "listener-task-processed";
      eventKey: string;
      tokenId: string;
      agentName: string;
      manifestUrl: string;
      blockNumber: number;
      transactionHash: string;
      auditStatus: ProcessedAuditRequested["writeback"]["status"];
      auditScore: number;
      reasonCode: string | null;
    }
  | {
      type: "listener-task-slashed";
      eventKey: string;
      tokenId: string;
      agentName: string;
      manifestUrl: string;
      blockNumber: number;
      transactionHash: string;
      slashReasonCode: SlashReasonCode;
    }
  | {
      type: "listener-task-slash-failed";
      eventKey: string;
      tokenId: string;
      agentName: string;
      manifestUrl: string;
      blockNumber: number;
      transactionHash: string;
      slashReasonCode: SlashReasonCode;
      error: string;
    }
  | {
      type: "listener-task-failed";
      eventKey: string;
      tokenId: string;
      agentName: string;
      manifestUrl: string;
      blockNumber: number;
      transactionHash: string;
      error: string;
    };

interface ListenerTaskEventBase {
  eventKey: string;
  tokenId: string;
  agentName: string;
  manifestUrl: string;
  blockNumber: number;
  transactionHash: string;
}

export interface PostWritebackSlashRequest {
  processed: ProcessedAuditRequested;
  decision: SlashDecision;
}

export interface RunAuditRequestedListenerOnceResult {
  processed: ProcessedAuditRequested[];
  latestBlockNumber: number;
  nextBlock: number;
}

export interface RunAuditRequestedListenerDependencies {
  deduper: InMemoryEventDeduper;
  getLatestBlockNumber: () => Promise<number>;
  pollAuditRequestedLogs: (options: {
    fromBlock: number;
    toBlock: number;
  }) => Promise<AuditRequestedEvent[]>;
  processAuditRequested: (event: AuditRequestedEvent) => Promise<ProcessedAuditRequested>;
  writeAuditResult?: (processed: ProcessedAuditRequested) => Promise<unknown>;
  evaluateSlashDecision?: (processed: ProcessedAuditRequested) => SlashDecision;
  handlePostWritebackSlash?: (request: PostWritebackSlashRequest) => Promise<void>;
  emitLifecycleEvent?: (event: ListenerTaskLifecycleEvent) => void | Promise<void>;
}

function buildEventBase(event: AuditRequestedEvent): ListenerTaskEventBase {
  return {
    eventKey: event.eventKey,
    tokenId: event.tokenId.toString(),
    agentName: event.agentName,
    manifestUrl: event.manifestUrl,
    blockNumber: event.blockNumber,
    transactionHash: event.transactionHash
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

export async function runAuditRequestedListenerOnce(
  options: {
    fromBlock: number;
  } & RunAuditRequestedListenerDependencies
): Promise<RunAuditRequestedListenerOnceResult> {
  const latestBlockNumber = await options.getLatestBlockNumber();

  if (latestBlockNumber < options.fromBlock) {
    return {
      processed: [],
      latestBlockNumber,
      nextBlock: options.fromBlock
    };
  }

  const events = await options.pollAuditRequestedLogs({
    fromBlock: options.fromBlock,
    toBlock: latestBlockNumber
  });
  const processed: ProcessedAuditRequested[] = [];

  for (const event of events) {
    const eventBase = buildEventBase(event);
    await options.emitLifecycleEvent?.({
      type: "listener-task-received",
      ...eventBase
    });

    if (!options.deduper.claim(event.eventKey)) {
      await options.emitLifecycleEvent?.({
        type: "listener-task-duplicate-skipped",
        ...eventBase
      });
      continue;
    }

    await options.emitLifecycleEvent?.({
      type: "listener-task-started",
      ...eventBase
    });

    let handled: ProcessedAuditRequested;
    try {
      handled = await options.processAuditRequested(event);
    } catch (error) {
      await options.emitLifecycleEvent?.({
        type: "listener-task-failed",
        ...eventBase,
        error: toErrorMessage(error)
      });
      throw error;
    }

    await options.emitLifecycleEvent?.({
      type: "listener-task-processed",
      ...eventBase,
      auditStatus: handled.writeback.status,
      auditScore: handled.writeback.auditScore,
      reasonCode: handled.auditResult.reasonCode ?? null
    });

    processed.push(handled);

    if (options.writeAuditResult) {
      await options.writeAuditResult(handled);
    }

    if (options.evaluateSlashDecision && options.handlePostWritebackSlash) {
      const decision = options.evaluateSlashDecision(handled);
      if (decision.outcome === "slash") {
        try {
          await options.handlePostWritebackSlash({ processed: handled, decision });
          await options.emitLifecycleEvent?.({
            type: "listener-task-slashed",
            ...eventBase,
            slashReasonCode: decision.reasonCode!
          });
        } catch (slashError) {
          await options.emitLifecycleEvent?.({
            type: "listener-task-slash-failed",
            ...eventBase,
            slashReasonCode: decision.reasonCode!,
            error: toErrorMessage(slashError)
          });
        }
      }
    }
  }

  return {
    processed,
    latestBlockNumber,
    nextBlock: latestBlockNumber + 1
  };
}
