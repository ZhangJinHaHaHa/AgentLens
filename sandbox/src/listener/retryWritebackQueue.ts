import type { ListenerRetryQueueItem, ProcessedAuditRequested } from "./types";
import type { LatestAuditReport } from "./readLatestAuditReport";
import { ZERO_EVIDENCE_HASH } from "../evidence/buildAuditEvidenceEvent";

export interface RetryQueueStateStore {
  readRetryQueue(): Promise<ListenerRetryQueueItem[]>;
  upsertRetry(item: ListenerRetryQueueItem): Promise<void>;
  removeRetry(eventKey: string): Promise<void>;
}

export interface RetryWritebackReceipt {
  transactionHash: `0x${string}`;
  blockNumber?: number;
}

export interface RetryWritebackResult {
  eventKey: string;
  outcome: "reconciled" | "confirmed" | "conflict" | "retry-scheduled";
  tokenId: string;
  transactionHash?: `0x${string}`;
  blockNumber?: number;
  attemptCount?: number;
  nextAttemptAt?: string;
  state?: ListenerRetryQueueItem["state"];
  error?: string;
}

export interface FlushRetryWritebackQueueOptions {
  state: RetryQueueStateStore;
  readLatestAuditReport: (tokenId: bigint) => Promise<LatestAuditReport>;
  submitWriteback: (item: ListenerRetryQueueItem) => Promise<RetryWritebackReceipt>;
  now?: () => Date;
}

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

function normalizeBytes32(value: string): `0x${string}` {
  if (value.startsWith("0x")) {
    return value as `0x${string}`;
  }

  return `0x${value}`;
}

function toExpectedStatus(status: ListenerRetryQueueItem["writeback"]["status"]): number {
  return status === "Passed" ? 1 : 2;
}

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function isReconciled(item: ListenerRetryQueueItem, latest: LatestAuditReport): boolean {
  return (
    latest.status === toExpectedStatus(item.writeback.status) &&
    latest.auditScore === item.writeback.auditScore &&
    latest.memoryPeakMb === item.writeback.memoryPeakMb &&
    latest.cpuAvgMilli === item.writeback.cpuAvgMilli &&
    latest.requestIpCount === item.writeback.requestIpCount &&
    sameHex(latest.manifestHash, item.writeback.manifestHash) &&
    sameHex(latest.reportHash, item.writeback.reportHash) &&
    sameHex(latest.evidenceRoot ?? ZERO_EVIDENCE_HASH, item.writeback.evidenceRoot ?? `0x${ZERO_EVIDENCE_HASH}`) &&
    sameHex(
      latest.attestationHash ?? ZERO_EVIDENCE_HASH,
      item.writeback.attestationHash ?? `0x${ZERO_EVIDENCE_HASH}`
    ) &&
    (latest.evidenceCID ?? "") === (item.writeback.evidenceCID ?? "") &&
    latest.reportCID === item.writeback.reportCID &&
    latest.manifestUrl === item.writeback.manifestUrl
  );
}

function isDue(item: ListenerRetryQueueItem, now: Date): boolean {
  return item.state === "pending" && Date.parse(item.nextAttemptAt) <= now.getTime();
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

export function createRetryQueueItem(
  processed: ProcessedAuditRequested,
  error: unknown,
  now: Date = new Date()
): ListenerRetryQueueItem {
  return {
    eventKey: processed.event.eventKey,
    state: "pending",
    tokenId: processed.writeback.tokenId.toString(),
    writeback: {
      status: processed.writeback.status,
      auditScore: processed.writeback.auditScore,
      memoryPeakMb: processed.writeback.memoryPeakMb,
      cpuAvgMilli: processed.writeback.cpuAvgMilli,
      requestIpCount: processed.writeback.requestIpCount,
      manifestHash: normalizeBytes32(processed.writeback.manifestHash),
      reportHash: normalizeBytes32(processed.writeback.reportHash),
      evidenceRoot: normalizeBytes32(processed.writeback.evidenceRoot ?? ZERO_EVIDENCE_HASH),
      attestationHash: normalizeBytes32(processed.writeback.attestationHash ?? ZERO_EVIDENCE_HASH),
      evidenceCID: processed.writeback.evidenceCID ?? "",
      reportCID: processed.writeback.reportCID,
      manifestUrl: processed.writeback.manifestUrl
    },
    attemptCount: 1,
    lastAttemptAt: now.toISOString(),
    nextAttemptAt: new Date(now.getTime() + getRetryBackoffMs(1)).toISOString(),
    lastError: toErrorMessage(error)
  };
}

export async function flushRetryWritebackQueue(
  options: FlushRetryWritebackQueueOptions
): Promise<RetryWritebackResult[]> {
  const now = options.now ?? (() => new Date());
  const queuedItems = await options.state.readRetryQueue();
  const results: RetryWritebackResult[] = [];

  for (const item of queuedItems) {
    const nowValue = now();
    if (!isDue(item, nowValue)) {
      continue;
    }

    const tokenId = BigInt(item.tokenId);

    try {
      const latest = await options.readLatestAuditReport(tokenId);

      if (isReconciled(item, latest)) {
        await options.state.removeRetry(item.eventKey);
        results.push({
          eventKey: item.eventKey,
          outcome: "reconciled",
          tokenId: item.tokenId
        });
        continue;
      }

      if (latest.status !== 0) {
        const conflictError = "latest on-chain audit record conflicts with queued writeback";
        const terminalItem: ListenerRetryQueueItem = {
          ...item,
          state: "terminal",
          lastAttemptAt: nowValue.toISOString(),
          lastError: conflictError
        };
        await options.state.upsertRetry(terminalItem);
        results.push({
          eventKey: item.eventKey,
          outcome: "conflict",
          tokenId: item.tokenId,
          state: terminalItem.state,
          error: conflictError
        });
        continue;
      }

      const receipt = await options.submitWriteback(item);
      await options.state.removeRetry(item.eventKey);
      results.push({
        eventKey: item.eventKey,
        outcome: "confirmed",
        tokenId: item.tokenId,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      });
    } catch (error) {
      const nextAttemptCount = item.attemptCount + 1;
      const nextAttemptAt = new Date(
        nowValue.getTime() + getRetryBackoffMs(nextAttemptCount)
      ).toISOString();
      const scheduledItem: ListenerRetryQueueItem = {
        ...item,
        attemptCount: nextAttemptCount,
        lastAttemptAt: nowValue.toISOString(),
        nextAttemptAt,
        lastError: toErrorMessage(error)
      };
      await options.state.upsertRetry(scheduledItem);
      results.push({
        eventKey: item.eventKey,
        outcome: "retry-scheduled",
        tokenId: item.tokenId,
        attemptCount: scheduledItem.attemptCount,
        nextAttemptAt: scheduledItem.nextAttemptAt,
        error: scheduledItem.lastError
      });
    }
  }

  return results;
}
