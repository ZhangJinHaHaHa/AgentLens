import type { AuditReportByIndex } from "./readAuditReportByIndex";
import type { ListenerSlashRetryItem, SlashReasonCode } from "./types";
import type { WriteSlashBondRequest } from "./writeSlashBond";

export interface SlashRetryStateStore {
  readSlashRetryQueue(): Promise<ListenerSlashRetryItem[]>;
  upsertSlashRetry(item: ListenerSlashRetryItem): Promise<void>;
  removeSlashRetry(eventKey: string): Promise<void>;
}

export interface RetrySlashResult {
  eventKey: string;
  outcome: "reconciled" | "confirmed" | "retry-scheduled";
  tokenId: string;
  auditId: number;
  transactionHash?: `0x${string}`;
  blockNumber?: number;
  attemptCount?: number;
  nextAttemptAt?: string;
  error?: string;
}

export interface CreateSlashRetryItemOptions {
  eventKey: string;
  tokenId: bigint;
  auditId: number;
  slashAmount: bigint;
  reasonCode: SlashReasonCode;
}

export interface FlushSlashRetryQueueOptions {
  state: SlashRetryStateStore;
  readAuditReportByIndex: (tokenId: bigint, index: number) => Promise<AuditReportByIndex>;
  submitSlashBond: (
    request: WriteSlashBondRequest
  ) => Promise<{ transactionHash: `0x${string}`; blockNumber?: number }>;
  now?: () => Date;
}

const SLASHED_AUDIT_STATUS = 3;

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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

function isDue(item: ListenerSlashRetryItem, now: Date): boolean {
  return item.state === "pending" && Date.parse(item.nextAttemptAt) <= now.getTime();
}

export function createSlashRetryItem(
  options: CreateSlashRetryItemOptions,
  error: unknown,
  now: Date = new Date()
): ListenerSlashRetryItem {
  return {
    eventKey: options.eventKey,
    state: "pending",
    tokenId: options.tokenId.toString(),
    auditId: options.auditId,
    slashAmount: options.slashAmount.toString(),
    reasonCode: options.reasonCode,
    attemptCount: 1,
    lastAttemptAt: now.toISOString(),
    nextAttemptAt: new Date(now.getTime() + getRetryBackoffMs(1)).toISOString(),
    lastError: toErrorMessage(error)
  };
}

export async function flushSlashRetryQueue(
  options: FlushSlashRetryQueueOptions
): Promise<RetrySlashResult[]> {
  const now = options.now ?? (() => new Date());
  const queuedItems = await options.state.readSlashRetryQueue();
  const results: RetrySlashResult[] = [];

  for (const item of queuedItems) {
    const nowValue = now();
    if (!isDue(item, nowValue)) {
      continue;
    }

    const tokenId = BigInt(item.tokenId);
    const index = item.auditId - 1;

    try {
      const record = await options.readAuditReportByIndex(tokenId, index);
      if (record.status === SLASHED_AUDIT_STATUS) {
        await options.state.removeSlashRetry(item.eventKey);
        results.push({
          eventKey: item.eventKey,
          outcome: "reconciled",
          tokenId: item.tokenId,
          auditId: item.auditId
        });
        continue;
      }

      const receipt = await options.submitSlashBond({
        tokenId,
        auditId: item.auditId,
        amount: BigInt(item.slashAmount),
        reasonCode: item.reasonCode
      });
      await options.state.removeSlashRetry(item.eventKey);
      results.push({
        eventKey: item.eventKey,
        outcome: "confirmed",
        tokenId: item.tokenId,
        auditId: item.auditId,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      });
    } catch (error) {
      const nextAttemptCount = item.attemptCount + 1;
      const nextAttemptAt = new Date(
        nowValue.getTime() + getRetryBackoffMs(nextAttemptCount)
      ).toISOString();
      const scheduledItem: ListenerSlashRetryItem = {
        ...item,
        attemptCount: nextAttemptCount,
        lastAttemptAt: nowValue.toISOString(),
        nextAttemptAt,
        lastError: toErrorMessage(error)
      };
      await options.state.upsertSlashRetry(scheduledItem);
      results.push({
        eventKey: item.eventKey,
        outcome: "retry-scheduled",
        tokenId: item.tokenId,
        auditId: item.auditId,
        attemptCount: scheduledItem.attemptCount,
        nextAttemptAt: scheduledItem.nextAttemptAt,
        error: scheduledItem.lastError
      });
    }
  }

  return results;
}
