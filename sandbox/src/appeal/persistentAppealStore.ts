import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

// 传输层先把 tokenId/auditId 规范为十进制字符串；store 保持该表示，避免 JSON number 对链上整数造成精度损失。
export interface AppealCreateInput {
  tokenId: string;
  auditId: string;
  auditIndex: number;
  reason: string;
  reportCID?: string;
  reportHash?: string;
  manifestUrl?: string;
}

// 此 intake 工作流以 reviewing 作为初态，和 AppealReviewRecord 的 pending/under_review 状态集不是可直接互换的 schema。
export type AppealStatus = "reviewing" | "approved" | "rejected";

/**
 * AppealTicket 是 appeals.json 中的持久化实体。可选证据字段允许读取早期记录，
 * 审核字段则只应由受保护的 reviewAppeal 路径补入。
 */
export interface AppealTicket extends AppealCreateInput {
  appealId: string;
  status: AppealStatus;
  createdAt: string;
  reviewer?: string;
  reviewResult?: string;
  reviewedAt?: string;
  compensationTxHash?: string;
}

export interface AppealReviewInput {
  // Exclude 在编译期阻止回到 reviewing；运行时调用者仍必须来自已鉴权且已校验的边界。
  status: Exclude<AppealStatus, "reviewing">;
  reviewer: string;
  reviewResult: string;
  compensationTxHash?: string;
}

export interface PersistentAppealStore {
  // stateDir 暴露实际状态根目录供启动日志/运维定位，但调用者不应绕过 store 同时改写同一文件。
  readonly stateDir: string;
  createAppeal(input: AppealCreateInput): Promise<AppealTicket>;
  readAppeals(): Promise<AppealTicket[]>;
  findLatestAppeal(tokenId: string, auditId: string): Promise<AppealTicket | undefined>;
  findAppealById(appealId: string): Promise<AppealTicket | undefined>;
  reviewAppeal(appealId: string, input: AppealReviewInput): Promise<AppealTicket>;
}

export interface PersistentAppealStoreOptions {
  stateDir: string;
  now?: () => Date;
  createAppealId?: () => string;
}

interface AppealStoreFile {
  // 单文件快照目前没有 schemaVersion；新增必填字段时必须继续兼容既有 JSON 或提供显式迁移。
  items: AppealTicket[];
  // updatedAt 描述整个快照最后写入时间，不用于判定单条申诉的“最新”顺序。
  updatedAt: string;
}

type AppealEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

const APPEALS_FILE_NAME = "appeals.json";

export function resolveDefaultAppealStateDir(cwd: string = process.cwd()): string {
  // 默认位置随进程 cwd 变化；部署必须固定工作目录或显式配置状态目录，避免重启后读取另一份空状态。
  return join(cwd, ".runtime", "appeals");
}

export function resolveAppealStateDir(stateDir?: string, cwd?: string): string {
  return stateDir ?? resolveDefaultAppealStateDir(cwd);
}

export function resolveAppealStateDirFromEnv(env: AppealEnv, cwd?: string): string {
  // 环境值按受信部署路径直接采用，不应允许 HTTP 请求或租户输入控制 AUDIT_APPEAL_STATE_DIR。
  return resolveAppealStateDir(env.AUDIT_APPEAL_STATE_DIR, cwd);
}

export function createPersistentAppealStore(
  options: PersistentAppealStoreOptions
): PersistentAppealStore {
  const now = options.now ?? (() => new Date());
  // 默认 ID 由时间与 Math.random 组成，便于本地唯一化但不具备密码学不可预测性，也没有持久化冲突检查。
  // 测试/集成可注入生成器；若要求安全幂等，调用方需提供稳定请求键及独立的唯一性机制。
  const createAppealId =
    options.createAppealId ??
    (() => `apl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const filePath = join(options.stateDir, APPEALS_FILE_NAME);

  async function ensureDirectory(): Promise<void> {
    await mkdir(options.stateDir, { recursive: true });
  }

  async function readStoreFile(): Promise<AppealStoreFile | undefined> {
    try {
      const raw = await readFile(filePath, "utf8");
      // 读取路径信任本模块写出的 JSON，并未做运行时 schema 校验；损坏、降级不兼容或外部篡改会直接抛错/产生错误形状。
      return JSON.parse(raw) as AppealStoreFile;
    } catch (error) {
      // 仅 ENOENT 表示尚无状态；权限、解析及其他 I/O 故障继续传播，避免被静默当成空库后覆盖。
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }

      throw error;
    }
  }

  async function writeStoreFile(items: AppealTicket[]): Promise<void> {
    await ensureDirectory();
    // 临时文件与目标文件同目录，rename 使读者不会看到半截 JSON；未调用 fsync，因此不承诺断电后的物理落盘。
    // 整个数组采用无锁读-改-写，跨请求/进程并发可能丢失更新，失败遗留的 .tmp 也不会由本函数清理。
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(
      tempPath,
      JSON.stringify(
        {
          items,
          updatedAt: now().toISOString()
        } satisfies AppealStoreFile,
        null,
        2
      ),
      "utf8"
    );
    await rename(tempPath, filePath);
  }

  return {
    stateDir: options.stateDir,
    async createAppeal(input: AppealCreateInput): Promise<AppealTicket> {
      // 每次调用都会生成新 ID 并追加记录；相同 tokenId/auditId 不去重，因此 POST 超时后的盲目重试可能创建第二张票。
      const ticket: AppealTicket = {
        appealId: createAppealId(),
        status: "reviewing",
        createdAt: now().toISOString(),
        ...input
      };
      const items = (await readStoreFile())?.items ?? [];
      // 数组追加顺序是 findLatestAppeal 的实际排序依据，不能用 createdAt 相等或回拨来替代这一不变式。
      items.push(ticket);
      await writeStoreFile(items);
      return ticket;
    },
    async readAppeals(): Promise<AppealTicket[]> {
      // 不存在的文件映射为空数组；其他读取错误保持 reject，使调用方能区分“没有数据”和“状态不可用”。
      return (await readStoreFile())?.items ?? [];
    },
    async findLatestAppeal(tokenId: string, auditId: string): Promise<AppealTicket | undefined> {
      const items = await this.readAppeals();
      // 从尾部扫描明确选择最后追加的匹配项，而不是最高 appealId 或最新时间戳；这是重复申诉兼容语义。
      for (let index = items.length - 1; index >= 0; index -= 1) {
        const item = items[index];
        if (item.tokenId === tokenId && item.auditId === auditId) {
          return item;
        }
      }

      return undefined;
    },
    async findAppealById(appealId: string): Promise<AppealTicket | undefined> {
      const items = await this.readAppeals();
      return items.find((item) => item.appealId === appealId);
    },
    async reviewAppeal(appealId: string, input: AppealReviewInput): Promise<AppealTicket> {
      // 查找、状态合并和整文件替换不带版本检查；并发审核可能最后写入者获胜，本 store 也不验证前态是否合法。
      const items = await this.readAppeals();
      const index = items.findIndex((item) => item.appealId === appealId);
      if (index === -1) {
        // intake HTTP 层依赖该精确文案映射 404；替换为结构化错误前需保持这一跨模块契约。
        throw new Error("Appeal not found.");
      }

      // 重复审核会刷新 reviewedAt，且补偿交易已经可能在调用本方法前发生；I/O 失败后的恢复应先重读票据与核对链上状态。
      const updated: AppealTicket = {
        ...items[index],
        status: input.status,
        reviewer: input.reviewer,
        reviewResult: input.reviewResult,
        reviewedAt: now().toISOString(),
        ...(input.compensationTxHash ? { compensationTxHash: input.compensationTxHash } : {})
      };
      items[index] = updated;
      await writeStoreFile(items);
      return updated;
    }
  };
}
