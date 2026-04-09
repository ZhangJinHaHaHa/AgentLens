import type {
  AuditRequestedEvent,
  ListenerAuditExecutionRetryItem,
  ProcessedAuditRequested
} from "./types";

export interface AuditExecutionRetryStateStore {
  readAuditExecutionRetryQueue(): Promise<ListenerAuditExecutionRetryItem[]>;
  upsertAuditExecutionRetry(item: ListenerAuditExecutionRetryItem): Promise<void>;
  removeAuditExecutionRetry(eventKey: string): Promise<void>;
}

export interface RetryAuditExecutionResult {
  eventKey: string;
  outcome: "completed" | "retry-scheduled";
  tokenId: string;
  processed?: ProcessedAuditRequested;
  attemptCount?: number;
  nextAttemptAt?: string;
  reasonCode?: string;
  error?: string;
}

export interface FlushAuditExecutionRetryQueueOptions {
  state: AuditExecutionRetryStateStore;
  processAuditRequested: (event: AuditRequestedEvent) => Promise<ProcessedAuditRequested>;
  now?: () => Date;
}

export const RETRYABLE_REASON_CODES = [
  "DOCKER_UNAVAILABLE",
  "IMAGE_PULL_FAILED",
  "CONTAINER_START_FAILED",
  "AGENT_UNAVAILABLE",
  "REQUEST_TIMEOUT",
  "REPORT_STORAGE_FAILED"
] as const;

export type RetryableAuditExecutionReasonCode = (typeof RETRYABLE_REASON_CODES)[number];

const RETRYABLE_REASON_CODE_SET = new Set<RetryableAuditExecutionReasonCode>(RETRYABLE_REASON_CODES);

function getRetryBackoffMs(attemptCount: number): number {
  if (attemptCount <= 1) {
    return 10_000;
  }

  if (attemptCount === 2) {
    return 30_000;
  }

  if (attemptCount === 3) {
    return 60_000;
  }

  return 300_000;
}

function buildRetryErrorMessage(reasonCode: string): string {
  return `retryable audit execution failure: ${reasonCode}`;
}

function toAuditRequestedEvent(item: ListenerAuditExecutionRetryItem): AuditRequestedEvent {
  return {
    eventKey: item.eventKey,
    tokenId: BigInt(item.tokenId),
    developer: item.developer,
    agentName: item.agentName,
    manifestUrl: item.manifestUrl,
    blockNumber: item.blockNumber,
    transactionHash: item.transactionHash
  };
}

function isDue(item: ListenerAuditExecutionRetryItem, now: Date): boolean {
  return Date.parse(item.nextAttemptAt) <= now.getTime();
}

export function isRetryableAuditExecutionFailure(processed: ProcessedAuditRequested): boolean {
  return (
    processed.auditResult.status === "failed" &&
    typeof processed.auditResult.reasonCode === "string" &&
    RETRYABLE_REASON_CODE_SET.has(processed.auditResult.reasonCode as RetryableAuditExecutionReasonCode)
  );
}

export function createAuditExecutionRetryItem(
  processed: ProcessedAuditRequested,
  now: Date = new Date()
): ListenerAuditExecutionRetryItem {
  const reasonCode = processed.auditResult.reasonCode;
  if (!reasonCode) {
    throw new Error("retryable audit execution failures require a reasonCode");
  }

  return {
    eventKey: processed.event.eventKey,
    tokenId: processed.event.tokenId.toString(),
    developer: processed.event.developer,
    agentName: processed.event.agentName,
    manifestUrl: processed.event.manifestUrl,
    blockNumber: processed.event.blockNumber,
    transactionHash: processed.event.transactionHash,
    attemptCount: 1,
    lastAttemptAt: now.toISOString(),
    nextAttemptAt: new Date(now.getTime() + getRetryBackoffMs(1)).toISOString(),
    lastReasonCode: reasonCode,
    lastError: buildRetryErrorMessage(reasonCode)
  };
}

export async function flushAuditExecutionRetryQueue(
  options: FlushAuditExecutionRetryQueueOptions
): Promise<RetryAuditExecutionResult[]> {
  const now = options.now ?? (() => new Date());
  const queuedItems = await options.state.readAuditExecutionRetryQueue();
  const results: RetryAuditExecutionResult[] = [];

  for (const item of queuedItems) {
    const nowValue = now();
    if (!isDue(item, nowValue)) {
      continue;
    }

    const processed = await options.processAuditRequested(toAuditRequestedEvent(item));

    if (!isRetryableAuditExecutionFailure(processed)) {
      await options.state.removeAuditExecutionRetry(item.eventKey);
      results.push({
        eventKey: item.eventKey,
        outcome: "completed",
        tokenId: item.tokenId,
        processed
      });
      continue;
    }

    const reasonCode = processed.auditResult.reasonCode as string;
    const nextAttemptCount = item.attemptCount + 1;
    const nextAttemptAt = new Date(
      nowValue.getTime() + getRetryBackoffMs(nextAttemptCount)
    ).toISOString();
    const scheduledItem: ListenerAuditExecutionRetryItem = {
      ...item,
      attemptCount: nextAttemptCount,
      lastAttemptAt: nowValue.toISOString(),
      nextAttemptAt,
      lastReasonCode: reasonCode,
      lastError: buildRetryErrorMessage(reasonCode)
    };
    await options.state.upsertAuditExecutionRetry(scheduledItem);
    results.push({
      eventKey: item.eventKey,
      outcome: "retry-scheduled",
      tokenId: item.tokenId,
      attemptCount: scheduledItem.attemptCount,
      nextAttemptAt: scheduledItem.nextAttemptAt,
      reasonCode,
      error: scheduledItem.lastError
    });
  }

  return results;
}
