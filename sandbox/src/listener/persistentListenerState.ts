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

/**
 * 该模块拥有监听游标及三种失败阶段的磁盘队列；重试资格、退避时间和链上对账策略仍由各自
 * retry*Queue 编排器负责。分文件存储使审计执行、结果写回和罚没失败互不覆盖，同一个 eventKey
 * 可以合法地出现在不同阶段的队列中。
 */
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
    // 文件尚未创建表示空状态；解析、权限和介质错误必须上抛，不能把损坏状态误当作“无待重试任务”。
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function writeJsonFileAtomic(filePath: string, value: unknown): Promise<void> {
  // rename 提供同目录内的快照替换，避免进程崩溃留下可见的半截 JSON；这里没有 fsync 或跨文件事务。
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

  /**
   * 文件名及 {items, updatedAt}/{nextBlock, updatedAt} 外壳是现有运行状态的兼容格式。
   * 读取使用类型断言而非模式迁移，因此修改字段形状时必须另行设计版本升级；当前实现会让畸形内容
   * 在后续使用处失败，而不会自动猜测或重写旧数据。
   */
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
      // 游标语义是“下一次开始扫描的区块”，并非最后完成的区块；CLI 只在整轮处理成功后推进它。
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
      // 每次返回磁盘快照；本模块不在内存中缓存，进程重启后仍可恢复尚未对账的写回。
      return (await readRetryQueueFile())?.items ?? [];
    },
    async enqueueRetry(item: ListenerRetryQueueItem): Promise<void> {
      const items = await this.readRetryQueue();
      // 首次入队按 eventKey 胜出；重复失败不会重置 attemptCount/nextAttemptAt，调度更新必须走 upsertRetry。
      if (items.some((existing) => existing.eventKey === item.eventKey)) {
        return;
      }

      items.push(item);
      await writeRetryQueue(items);
    },
    async upsertRetry(item: ListenerRetryQueueItem): Promise<void> {
      // upsert 替换同键完整快照，用于持久化退避次数或 terminal 状态，同时保留原队列位置。
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
      // 删除不存在的键不产生磁盘写入，使成功后的重复清理保持幂等。
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
      // 执行级重试保存重建 AuditRequestedEvent 所需的全部字段，并在本队列内按 eventKey 去重。
      if (items.some((existing) => existing.eventKey === item.eventKey)) {
        return;
      }

      items.push(item);
      await writeAuditExecutionRetryQueue(items);
    },
    async upsertAuditExecutionRetry(item: ListenerAuditExecutionRetryItem): Promise<void> {
      // 退避计算由 retryAuditExecutionQueue 完成；本层只原样替换已计算好的下一次执行快照。
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
      // 成功执行后的重复确认不会改写文件时间戳，便于运维区分真实队列变更。
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
      // 罚没重试与结果写回重试使用独立命名空间，防止同一事件的两个链上阶段相互去重。
      if (items.some((existing) => existing.eventKey === item.eventKey)) {
        return;
      }

      items.push(item);
      await writeSlashRetryQueue(items);
    },
    async upsertSlashRetry(item: ListenerSlashRetryItem): Promise<void> {
      // 金额和 tokenId 以十进制字符串持久化以兼容 JSON；消费端恢复 bigint 并承担格式校验。
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

      // 三类队列的写入都是“读完整数组—改一项—写完整数组”，安全性依赖服务锁保证单写者。
      await writeSlashRetryQueue(nextItems);
    }
  };
}
