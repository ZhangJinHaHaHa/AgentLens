import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  AppealReviewCreateInput,
  AppealReviewRecord,
  AppealReviewStatus
} from "./appealReviewTypes";

/**
 * 该 store 是审核记录的文件持久化所有者：每个 appealId 对应一个 JSON 文件，调用者不应绕过接口直接改写目录。
 * 接口本身不承诺事务隔离、跨进程锁或幂等更新；这些限制会直接影响并发审核与失败重试策略。
 */
export interface AppealReviewStore {
  create(input: AppealReviewCreateInput): Promise<AppealReviewRecord>;
  findById(appealId: string): Promise<AppealReviewRecord | undefined>;
  update(
    appealId: string,
    fields: Partial<AppealReviewRecord>
  ): Promise<AppealReviewRecord>;
  listAll(): Promise<readonly AppealReviewRecord[]>;
  listByStatus(status: AppealReviewStatus): Promise<readonly AppealReviewRecord[]>;
}

export interface AppealReviewStoreOptions {
  // stateDir 是受信部署配置并决定真实文件边界；不得直接取自请求参数或租户可控输入。
  readonly stateDir: string;
  readonly now?: () => Date;
}

const REVIEWS_DIR_NAME = "appeal-reviews";

function resolveReviewsDir(stateDir: string): string {
  // 子目录名是现有磁盘布局的一部分；改名需要迁移历史记录，而不能仅修改常量。
  return join(stateDir, REVIEWS_DIR_NAME);
}

function resolveRecordPath(stateDir: string, appealId: string): string {
  // appealId 被直接用于文件名且没有路径规范化；调用边界必须保证它是不含分隔符、.. 或绝对路径语义的安全段。
  return join(resolveReviewsDir(stateDir), `${appealId}.json`);
}

async function ensureReviewsDir(stateDir: string): Promise<void> {
  await mkdir(resolveReviewsDir(stateDir), { recursive: true });
}

async function readRecordFile(
  stateDir: string,
  appealId: string
): Promise<AppealReviewRecord | undefined> {
  try {
    const raw = await readFile(resolveRecordPath(stateDir, appealId), "utf8");
    // 磁盘 JSON 被视为内部可信状态并通过类型断言恢复；字段缺失、旧 schema 或恶意篡改不会在此进行运行时校验。
    return JSON.parse(raw) as AppealReviewRecord;
  } catch (error) {
    // 只有文件不存在被解释为业务上的“未找到”；权限、损坏 JSON 和其他 I/O 错误必须向调用方传播。
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function writeRecordFile(
  stateDir: string,
  record: AppealReviewRecord
): Promise<void> {
  await ensureReviewsDir(stateDir);
  const filePath = resolveRecordPath(stateDir, record.appealId);
  // 临时文件与目标位于同一目录，rename 可避免读者看到半写 JSON；它不等价于 fsync 后的断电持久性保证。
  // 文件名仅含 pid 与毫秒时间，且没有锁/清理协议；同进程同毫秒并发写仍可能争用临时路径或相互覆盖。
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(record, null, 2), "utf8");
  await rename(tempPath, filePath);
}

async function readAllRecordFiles(
  stateDir: string
): Promise<readonly AppealReviewRecord[]> {
  const reviewsDir = resolveReviewsDir(stateDir);

  let entries: string[];
  try {
    entries = await readdir(reviewsDir);
  } catch (error) {
    // 尚未创建目录等价于空集合；其他目录读取失败保留为可观测异常，避免把运维故障伪装成“没有申诉”。
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  // 只读取最终 .json 文件，因此正常写入中的 .tmp 不会暴露给列表；遗留临时文件也不会在这里自动清理。
  const jsonFiles = entries.filter((entry) => entry.endsWith(".json"));
  const records: AppealReviewRecord[] = [];

  for (const fileName of jsonFiles) {
    // 任一文件不可读或 JSON 损坏都会使整次列表失败；返回顺序沿用 readdir，未定义按时间或标识排序。
    const raw = await readFile(join(reviewsDir, fileName), "utf8");
    records.push(JSON.parse(raw) as AppealReviewRecord);
  }

  return records;
}

export function createAppealReviewStore(
  options: AppealReviewStoreOptions
): AppealReviewStore {
  const { stateDir } = options;
  // 时钟只参与 createdAt；更新时的 reviewedAt 由审核 handler 提供，保持状态职责分离。
  const now = options.now ?? (() => new Date());

  return {
    async create(input: AppealReviewCreateInput): Promise<AppealReviewRecord> {
      // 该检查令串行重复创建显式失败，但“先查再写”不是原子 create-if-absent；并发调用仍可能最后写入者获胜。
      const existing = await readRecordFile(stateDir, input.appealId);
      if (existing) {
        throw new Error(
          `Appeal review record already exists: ${input.appealId}`
        );
      }

      // pending 是新记录唯一入口状态；字段逐项复制也避免调用方额外属性渗入持久化 schema。
      const record: AppealReviewRecord = {
        appealId: input.appealId,
        eventKey: input.eventKey,
        tokenId: input.tokenId,
        status: "pending",
        reason: input.reason,
        slashReasonCode: input.slashReasonCode,
        originalAuditScore: input.originalAuditScore,
        createdAt: now().toISOString()
      };

      await writeRecordFile(stateDir, record);
      return record;
    },

    async findById(
      appealId: string
    ): Promise<AppealReviewRecord | undefined> {
      return readRecordFile(stateDir, appealId);
    },

    async update(
      appealId: string,
      fields: Partial<AppealReviewRecord>
    ): Promise<AppealReviewRecord> {
      const existing = await readRecordFile(stateDir, appealId);
      if (!existing) {
        throw new Error(
          `Appeal review record not found: ${appealId}`
        );
      }

      // 合并允许 Partial 覆盖包括 appealId/status 在内的任意字段，store 不执行状态机或身份不变式校验；可信 handler 必须先约束 fields。
      // 这是无版本号的读-改-写，并发更新可能丢失；I/O 结果未知时应重新读取记录，而不是直接重放外部副作用。
      const updated: AppealReviewRecord = { ...existing, ...fields };
      await writeRecordFile(stateDir, updated);
      return updated;
    },

    async listAll(): Promise<readonly AppealReviewRecord[]> {
      return readAllRecordFiles(stateDir);
    },

    async listByStatus(
      status: AppealReviewStatus
    ): Promise<readonly AppealReviewRecord[]> {
      // 状态过滤在完整读取后于内存执行；状态字面量同时是落盘格式和 API 过滤协议，不能无迁移地重命名。
      const all = await readAllRecordFiles(stateDir);
      return all.filter((record) => record.status === status);
    }
  };
}
