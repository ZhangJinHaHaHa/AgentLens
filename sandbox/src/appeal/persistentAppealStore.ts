import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface AppealCreateInput {
  tokenId: string;
  auditId: string;
  auditIndex: number;
  reason: string;
  reportCID?: string;
  reportHash?: string;
  manifestUrl?: string;
}

export type AppealStatus = "reviewing" | "approved" | "rejected";

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
  status: Exclude<AppealStatus, "reviewing">;
  reviewer: string;
  reviewResult: string;
  compensationTxHash?: string;
}

export interface PersistentAppealStore {
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
  items: AppealTicket[];
  updatedAt: string;
}

type AppealEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

const APPEALS_FILE_NAME = "appeals.json";

export function resolveDefaultAppealStateDir(cwd: string = process.cwd()): string {
  return join(cwd, ".runtime", "appeals");
}

export function resolveAppealStateDir(stateDir?: string, cwd?: string): string {
  return stateDir ?? resolveDefaultAppealStateDir(cwd);
}

export function resolveAppealStateDirFromEnv(env: AppealEnv, cwd?: string): string {
  return resolveAppealStateDir(env.AUDIT_APPEAL_STATE_DIR, cwd);
}

export function createPersistentAppealStore(
  options: PersistentAppealStoreOptions
): PersistentAppealStore {
  const now = options.now ?? (() => new Date());
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
      return JSON.parse(raw) as AppealStoreFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }

      throw error;
    }
  }

  async function writeStoreFile(items: AppealTicket[]): Promise<void> {
    await ensureDirectory();
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
      const ticket: AppealTicket = {
        appealId: createAppealId(),
        status: "reviewing",
        createdAt: now().toISOString(),
        ...input
      };
      const items = (await readStoreFile())?.items ?? [];
      items.push(ticket);
      await writeStoreFile(items);
      return ticket;
    },
    async readAppeals(): Promise<AppealTicket[]> {
      return (await readStoreFile())?.items ?? [];
    },
    async findLatestAppeal(tokenId: string, auditId: string): Promise<AppealTicket | undefined> {
      const items = await this.readAppeals();
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
      const items = await this.readAppeals();
      const index = items.findIndex((item) => item.appealId === appealId);
      if (index === -1) {
        throw new Error("Appeal not found.");
      }

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
