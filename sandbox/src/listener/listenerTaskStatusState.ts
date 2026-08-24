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

/**
 * task-status.json 是生命周期事件的可查询投影，不是审计、写回或重试的事实来源。
 * 每个 eventKey 只有一条当前快照，history 仅保留最近若干次转换，便于诊断而不无限增长。
 */
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
    // 首次启动缺文件等价于空状态；损坏 JSON 和权限错误则失败，避免悄悄抹掉既有任务历史。
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function writeJsonFileAtomic(filePath: string, value: unknown): Promise<void> {
  // 同目录临时文件再 rename 保护读者免受部分写入；未做 fsync，且不能解决多进程同时 read-modify-write。
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
  // reasonCode 的“属性缺席”与“显式清空”语义不同；稀疏事件因此不会伪造一条原因码更新。
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

  /**
   * 本文件采用整表快照写入，依赖 ListenerServiceState 对 stateDir 建立的单写者约束。
   * 若绕过服务锁并发调用 recordEvent，原子 rename 只能保证文件完整，不能防止较晚写入覆盖另一进程的更新。
   */
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
      // 缺文件返回新数组，调用方获得快照而不是由本模块维护的可变内存状态。
      return (await readTaskStatusFile())?.items ?? [];
    },
    async recordEvent(event: Record<string, unknown>): Promise<void> {
      const eventKey = readString(event.eventKey);
      // 服务级心跳等事件没有 eventKey，不属于任务投影；忽略它们也不会创建无法关联的伪任务。
      if (!eventKey) {
        return;
      }

      const at = now().toISOString();
      const items = await this.readTaskStatuses();
      const existing = items.find((item) => item.eventKey === eventKey);
      // 稀疏的后续事件只覆盖其携带的字段；原始 block/transaction 一旦记录便保持事件来源身份，
      // 不会被链上写回交易的区块号和交易哈希替换。
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
        // 只保留尾部窗口；当前快照仍保存合并后的关键字段，因此截断历史不会改变最新任务状态。
        history: [...(existing?.history ?? []), buildHistoryEntry(event, at)].slice(-historyLimit)
      };

      const nextItems = existing
        ? items.map((item) => (item.eventKey === eventKey ? next : item))
        : [...items, next];
      // eventKey 是此投影的幂等身份：重复键更新原记录，首次出现才追加，文件内不会生成两条同键任务。
      await writeTaskStatusFile(nextItems, at);
    }
  };
}
