import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ListenerServiceLockMetadata {
  pid: number;
  startedAt: string;
}

export interface ListenerServiceStatus {
  pid: number;
  state: "starting" | "running" | "stopped" | "failed";
  startedAt: string;
  updatedAt: string;
  lastSignal?: NodeJS.Signals;
  lastPollAt?: string;
  nextBlock?: number;
  lastError?: string;
}

export interface ListenerServiceState {
  readonly stateDir: string;
  acquireLock(metadata: ListenerServiceLockMetadata): Promise<void>;
  writeStatus(status: ListenerServiceStatus): Promise<void>;
  releaseLock(): Promise<void>;
}

export interface ListenerServiceStateOptions {
  stateDir: string;
}

const LOCK_FILE_NAME = "service-lock.json";
const STATUS_FILE_NAME = "runtime-status.json";

async function ensureDirectory(stateDir: string): Promise<void> {
  await mkdir(stateDir, { recursive: true });
}

async function writeJsonFileAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await rename(tempPath, filePath);
}

async function readExistingLockMetadata(
  lockPath: string
): Promise<ListenerServiceLockMetadata | undefined> {
  try {
    const value = JSON.parse(await readFile(lockPath, "utf8")) as Partial<
      ListenerServiceLockMetadata
    >;
    const pid = value.pid;
    if (typeof pid === "number" && Number.isInteger(pid) && typeof value.startedAt === "string") {
      return {
        pid,
        startedAt: value.startedAt
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function isProcessAlive(pid: number): boolean {
  if (pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "EPERM";
  }
}

async function removeStaleLock(lockPath: string): Promise<void> {
  try {
    await rm(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export function createListenerServiceState(
  options: ListenerServiceStateOptions
): ListenerServiceState {
  const lockPath = join(options.stateDir, LOCK_FILE_NAME);
  const statusPath = join(options.stateDir, STATUS_FILE_NAME);
  let lockHeld = false;

  return {
    stateDir: options.stateDir,
    async acquireLock(metadata: ListenerServiceLockMetadata): Promise<void> {
      await ensureDirectory(options.stateDir);

      let staleLockRemoved = false;
      try {
        const handle = await open(lockPath, "wx");
        try {
          await handle.writeFile(JSON.stringify(metadata, null, 2), "utf8");
        } finally {
          await handle.close();
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          const existingLock = await readExistingLockMetadata(lockPath);
          if (existingLock && isProcessAlive(existingLock.pid)) {
            throw new Error(`listener state directory is already locked: ${lockPath}`);
          }

          await removeStaleLock(lockPath);
          staleLockRemoved = true;
        } else {
          throw error;
        }
      }

      if (staleLockRemoved) {
        const handle = await open(lockPath, "wx");
        try {
          await handle.writeFile(JSON.stringify(metadata, null, 2), "utf8");
        } finally {
          await handle.close();
        }
      }

      lockHeld = true;
    },
    async writeStatus(status: ListenerServiceStatus): Promise<void> {
      await ensureDirectory(options.stateDir);
      await writeJsonFileAtomic(statusPath, status);
    },
    async releaseLock(): Promise<void> {
      if (!lockHeld) {
        return;
      }

      try {
        await rm(lockPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      } finally {
        lockHeld = false;
      }
    }
  };
}
