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

/**
 * 该对象只拥有一个 stateDir 下的进程互斥锁与可观测运行状态；业务游标和重试队列由
 * PersistentListenerState 分别管理。CLI 在写任何监听状态前先取得此锁，从而为后续
 * read-modify-write 文件提供单写者前提。
 */
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
  // 临时文件与目标文件位于同一目录，rename 可避免读者看到半截 JSON；这不包含 fsync，不能等同于断电持久性。
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await rename(tempPath, filePath);
}

async function readExistingLockMetadata(
  lockPath: string
): Promise<ListenerServiceLockMetadata | undefined> {
  try {
    // 锁文件是本地运行态输入，只接受整数 pid 与字符串 startedAt；损坏或旧格式文件按不可用元数据处理。
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
    // 无法读取/解析的锁无法证明仍有活跃所有者，交由后续独占创建重新建立一致状态。
    return undefined;
  }

  return undefined;
}

function isProcessAlive(pid: number): boolean {
  if (pid <= 0) {
    return false;
  }

  try {
    // signal 0 不发送实际信号；EPERM 说明进程存在但当前身份无权探测，必须保守地视为存活。
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
    // 多个恢复者竞争删除时 ENOENT 等价于目标已经达成，其余权限或文件系统错误继续上抛。
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
  // 这是当前对象的所有权标记，不从磁盘反推；releaseLock 只清理本对象成功取得的锁。
  let lockHeld = false;

  return {
    stateDir: options.stateDir,
    async acquireLock(metadata: ListenerServiceLockMetadata): Promise<void> {
      await ensureDirectory(options.stateDir);

      let staleLockRemoved = false;
      try {
        // "wx" 的原子独占创建是互斥点；先检查再普通写文件会留下两个监听器同时运行的竞态。
        const handle = await open(lockPath, "wx");
        try {
          await handle.writeFile(JSON.stringify(metadata, null, 2), "utf8");
        } finally {
          await handle.close();
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          const existingLock = await readExistingLockMetadata(lockPath);
          // startedAt 是诊断信息；活性判断只基于 pid，因此跨 PID 命名空间或 PID 复用需由部署层避免。
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
        // 删除旧锁后再次使用 "wx" 竞争；若另一实例先取得锁，本次会失败而不会覆盖新所有者。
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
      // 状态文件是给运维读取的最新快照，终止后仍保留；它不是锁，也不参与游标恢复决策。
      await ensureDirectory(options.stateDir);
      await writeJsonFileAtomic(statusPath, status);
    },
    async releaseLock(): Promise<void> {
      // 重复释放在对象级别幂等，避免 finally 路径因前序获取失败而删除不属于自己的锁。
      if (!lockHeld) {
        return;
      }

      try {
        await rm(lockPath);
      } catch (error) {
        // 锁已被外部清理时仍视为释放成功；其他 I/O 错误必须暴露，否则会遗留假所有权状态。
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      } finally {
        lockHeld = false;
      }
    }
  };
}
