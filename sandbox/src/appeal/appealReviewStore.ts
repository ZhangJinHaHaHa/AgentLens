import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  AppealReviewCreateInput,
  AppealReviewRecord,
  AppealReviewStatus
} from "./appealReviewTypes";

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
  readonly stateDir: string;
  readonly now?: () => Date;
}

const REVIEWS_DIR_NAME = "appeal-reviews";

function resolveReviewsDir(stateDir: string): string {
  return join(stateDir, REVIEWS_DIR_NAME);
}

function resolveRecordPath(stateDir: string, appealId: string): string {
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
    return JSON.parse(raw) as AppealReviewRecord;
  } catch (error) {
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
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const jsonFiles = entries.filter((entry) => entry.endsWith(".json"));
  const records: AppealReviewRecord[] = [];

  for (const fileName of jsonFiles) {
    const raw = await readFile(join(reviewsDir, fileName), "utf8");
    records.push(JSON.parse(raw) as AppealReviewRecord);
  }

  return records;
}

export function createAppealReviewStore(
  options: AppealReviewStoreOptions
): AppealReviewStore {
  const { stateDir } = options;
  const now = options.now ?? (() => new Date());

  return {
    async create(input: AppealReviewCreateInput): Promise<AppealReviewRecord> {
      const existing = await readRecordFile(stateDir, input.appealId);
      if (existing) {
        throw new Error(
          `Appeal review record already exists: ${input.appealId}`
        );
      }

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
      const all = await readAllRecordFiles(stateDir);
      return all.filter((record) => record.status === status);
    }
  };
}
