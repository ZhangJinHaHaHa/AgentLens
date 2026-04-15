import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ListenerTaskStatusHistoryEntry {
  state: string;
  at: string;
  reasonCode?: string | null;
  error?: string;
  auditStatus?: string;
  auditScore?: number;
}

export interface ListenerTaskStatusRecord {
  eventKey: string;
  tokenId: string;
  agentName: string;
  manifestUrl: string;
  blockNumber: number | null;
  transactionHash: string;
  state: string;
  updatedAt: string;
  reasonCode: string | null;
  error: string | null;
  auditStatus: string | null;
  auditScore: number | null;
  history: ListenerTaskStatusHistoryEntry[];
}

interface ListenerTaskStatusFile {
  items: ListenerTaskStatusRecord[];
  updatedAt: string;
}

export interface ListenerTaskStatusState {
  readonly stateDir: string;
  readTaskStatuses(): Promise<ListenerTaskStatusRecord[]>;
  recordEvent(event: Record<string, unknown>): Promise<void>;
}

export interface ListenerTaskStatusStateOptions {
  stateDir: string;
  now?: () => Date;
  historyLimit?: number;
}

const TASK_STATUS_FILE_NAME = "task-status.json";

async function ensureDirectory(stateDir: string): Promise<void> {
  await mkdir(stateDir, { recursive: true });
}

async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function writeJsonFileAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await rename(tempPath, filePath);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function buildHistoryEntry(event: Record<string, unknown>, at: string): ListenerTaskStatusHistoryEntry {
  return {
    state: readString(event.type) ?? "unknown",
    at,
    reasonCode: "reasonCode" in event ? (readString(event.reasonCode) ?? null) : undefined,
    error: readString(event.error),
    auditStatus: readString(event.auditStatus),
    auditScore: readNumber(event.auditScore)
  };
}

export function createListenerTaskStatusState(
  options: ListenerTaskStatusStateOptions
): ListenerTaskStatusState {
  const now = options.now ?? (() => new Date());
  const historyLimit = options.historyLimit ?? 10;
  const taskStatusPath = join(options.stateDir, TASK_STATUS_FILE_NAME);

  async function readTaskStatusFile(): Promise<ListenerTaskStatusFile | undefined> {
    return readJsonFile<ListenerTaskStatusFile>(taskStatusPath);
  }

  async function writeTaskStatusFile(
    items: ListenerTaskStatusRecord[],
    updatedAt: string
  ): Promise<void> {
    await ensureDirectory(options.stateDir);
    await writeJsonFileAtomic(taskStatusPath, {
      items,
      updatedAt
    } satisfies ListenerTaskStatusFile);
  }

  return {
    stateDir: options.stateDir,
    async readTaskStatuses(): Promise<ListenerTaskStatusRecord[]> {
      return (await readTaskStatusFile())?.items ?? [];
    },
    async recordEvent(event: Record<string, unknown>): Promise<void> {
      const eventKey = readString(event.eventKey);
      if (!eventKey) {
        return;
      }

      const at = now().toISOString();
      const items = await this.readTaskStatuses();
      const existing = items.find((item) => item.eventKey === eventKey);
      const next: ListenerTaskStatusRecord = {
        eventKey,
        tokenId: readString(event.tokenId) ?? existing?.tokenId ?? "",
        agentName: readString(event.agentName) ?? existing?.agentName ?? "",
        manifestUrl: readString(event.manifestUrl) ?? existing?.manifestUrl ?? "",
        blockNumber: existing?.blockNumber ?? readNumber(event.blockNumber) ?? null,
        transactionHash: existing?.transactionHash ?? readString(event.transactionHash) ?? "",
        state: readString(event.type) ?? existing?.state ?? "unknown",
        updatedAt: at,
        reasonCode:
          "reasonCode" in event ? (readString(event.reasonCode) ?? null) : (existing?.reasonCode ?? null),
        error: "error" in event ? (readString(event.error) ?? null) : (existing?.error ?? null),
        auditStatus:
          "auditStatus" in event ? (readString(event.auditStatus) ?? null) : (existing?.auditStatus ?? null),
        auditScore:
          "auditScore" in event ? (readNumber(event.auditScore) ?? null) : (existing?.auditScore ?? null),
        history: [...(existing?.history ?? []), buildHistoryEntry(event, at)].slice(-historyLimit)
      };

      const nextItems = existing
        ? items.map((item) => (item.eventKey === eventKey ? next : item))
        : [...items, next];
      await writeTaskStatusFile(nextItems, at);
    }
  };
}
