import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  ListenerAuditExecutionRetryItem,
  ListenerSlashRetryItem,
  ListenerRetryQueueItem,
  PersistedListenerCursor
} from "./types";

interface RetryQueueFile {
  items: ListenerRetryQueueItem[];
  updatedAt: string;
}

interface AuditExecutionRetryQueueFile {
  items: ListenerAuditExecutionRetryItem[];
  updatedAt: string;
}

interface SlashRetryQueueFile {
  items: ListenerSlashRetryItem[];
  updatedAt: string;
}

export interface PersistentListenerStateOptions {
  stateDir: string;
  now?: () => Date;
}

export interface PersistentListenerState {
  readonly stateDir: string;
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

const CURSOR_FILE_NAME = "cursor.json";
const RETRY_QUEUE_FILE_NAME = "retry-queue.json";
const AUDIT_EXECUTION_RETRY_QUEUE_FILE_NAME = "audit-execution-retry.json";
const SLASH_RETRY_QUEUE_FILE_NAME = "slash-retry-queue.json";

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

export function createPersistentListenerState(
  options: PersistentListenerStateOptions
): PersistentListenerState {
  const now = options.now ?? (() => new Date());
  const cursorPath = join(options.stateDir, CURSOR_FILE_NAME);
  const retryQueuePath = join(options.stateDir, RETRY_QUEUE_FILE_NAME);
  const auditExecutionRetryQueuePath = join(options.stateDir, AUDIT_EXECUTION_RETRY_QUEUE_FILE_NAME);
  const slashRetryQueuePath = join(options.stateDir, SLASH_RETRY_QUEUE_FILE_NAME);

  async function readCursorFile(): Promise<PersistedListenerCursor | undefined> {
    return readJsonFile<PersistedListenerCursor>(cursorPath);
  }

  async function readRetryQueueFile(): Promise<RetryQueueFile | undefined> {
    return readJsonFile<RetryQueueFile>(retryQueuePath);
  }

  async function readAuditExecutionRetryQueueFile(): Promise<AuditExecutionRetryQueueFile | undefined> {
    return readJsonFile<AuditExecutionRetryQueueFile>(auditExecutionRetryQueuePath);
  }

  async function readSlashRetryQueueFile(): Promise<SlashRetryQueueFile | undefined> {
    return readJsonFile<SlashRetryQueueFile>(slashRetryQueuePath);
  }

  async function writeRetryQueue(items: ListenerRetryQueueItem[]): Promise<void> {
    await ensureDirectory(options.stateDir);
    await writeJsonFileAtomic(retryQueuePath, {
      items,
      updatedAt: now().toISOString()
    } satisfies RetryQueueFile);
  }

  async function writeAuditExecutionRetryQueue(
    items: ListenerAuditExecutionRetryItem[]
  ): Promise<void> {
    await ensureDirectory(options.stateDir);
    await writeJsonFileAtomic(auditExecutionRetryQueuePath, {
      items,
      updatedAt: now().toISOString()
    } satisfies AuditExecutionRetryQueueFile);
  }

  async function writeSlashRetryQueue(items: ListenerSlashRetryItem[]): Promise<void> {
    await ensureDirectory(options.stateDir);
    await writeJsonFileAtomic(slashRetryQueuePath, {
      items,
      updatedAt: now().toISOString()
    } satisfies SlashRetryQueueFile);
  }

  return {
    stateDir: options.stateDir,
    async readCursor(): Promise<number | undefined> {
      return (await readCursorFile())?.nextBlock;
    },
    async writeCursor(nextBlock: number): Promise<void> {
      await ensureDirectory(options.stateDir);
      await writeJsonFileAtomic(cursorPath, {
        nextBlock,
        updatedAt: now().toISOString()
      } satisfies PersistedListenerCursor);
    },
    async readRetryQueue(): Promise<ListenerRetryQueueItem[]> {
      return (await readRetryQueueFile())?.items ?? [];
    },
    async enqueueRetry(item: ListenerRetryQueueItem): Promise<void> {
      const items = await this.readRetryQueue();
      if (items.some((existing) => existing.eventKey === item.eventKey)) {
        return;
      }

      items.push(item);
      await writeRetryQueue(items);
    },
    async upsertRetry(item: ListenerRetryQueueItem): Promise<void> {
      const items = await this.readRetryQueue();
      const index = items.findIndex((existing) => existing.eventKey === item.eventKey);
      if (index === -1) {
        items.push(item);
      } else {
        items[index] = item;
      }

      await writeRetryQueue(items);
    },
    async removeRetry(eventKey: string): Promise<void> {
      const items = await this.readRetryQueue();
      const nextItems = items.filter((item) => item.eventKey !== eventKey);
      if (nextItems.length === items.length) {
        return;
      }

      await writeRetryQueue(nextItems);
    },
    async readAuditExecutionRetryQueue(): Promise<ListenerAuditExecutionRetryItem[]> {
      return (await readAuditExecutionRetryQueueFile())?.items ?? [];
    },
    async enqueueAuditExecutionRetry(item: ListenerAuditExecutionRetryItem): Promise<void> {
      const items = await this.readAuditExecutionRetryQueue();
      if (items.some((existing) => existing.eventKey === item.eventKey)) {
        return;
      }

      items.push(item);
      await writeAuditExecutionRetryQueue(items);
    },
    async upsertAuditExecutionRetry(item: ListenerAuditExecutionRetryItem): Promise<void> {
      const items = await this.readAuditExecutionRetryQueue();
      const index = items.findIndex((existing) => existing.eventKey === item.eventKey);
      if (index === -1) {
        items.push(item);
      } else {
        items[index] = item;
      }

      await writeAuditExecutionRetryQueue(items);
    },
    async removeAuditExecutionRetry(eventKey: string): Promise<void> {
      const items = await this.readAuditExecutionRetryQueue();
      const nextItems = items.filter((item) => item.eventKey !== eventKey);
      if (nextItems.length === items.length) {
        return;
      }

      await writeAuditExecutionRetryQueue(nextItems);
    },
    async readSlashRetryQueue(): Promise<ListenerSlashRetryItem[]> {
      return (await readSlashRetryQueueFile())?.items ?? [];
    },
    async enqueueSlashRetry(item: ListenerSlashRetryItem): Promise<void> {
      const items = await this.readSlashRetryQueue();
      if (items.some((existing) => existing.eventKey === item.eventKey)) {
        return;
      }

      items.push(item);
      await writeSlashRetryQueue(items);
    },
    async upsertSlashRetry(item: ListenerSlashRetryItem): Promise<void> {
      const items = await this.readSlashRetryQueue();
      const index = items.findIndex((existing) => existing.eventKey === item.eventKey);
      if (index === -1) {
        items.push(item);
      } else {
        items[index] = item;
      }

      await writeSlashRetryQueue(items);
    },
    async removeSlashRetry(eventKey: string): Promise<void> {
      const items = await this.readSlashRetryQueue();
      const nextItems = items.filter((item) => item.eventKey !== eventKey);
      if (nextItems.length === items.length) {
        return;
      }

      await writeSlashRetryQueue(nextItems);
    }
  };
}
