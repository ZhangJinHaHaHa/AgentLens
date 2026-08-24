/**
 * 证据验证 CLI 负责把 eventKey 映射到 listener evidence 目录并调用持久证据的完整性校验；它不重放审计、不重建 Merkle 证据，也不修复损坏文件。
 * 命令行标识、可选 stateDir 和磁盘内容跨越用户/文件信任边界，输出始终是一行 JSON，只有 status=verified 才返回零退出码。
 * 无效事件键在任何文件访问前转换成稳定的 invalid_event_key 结果；不存在、哈希不符或结构不合法必须保持非零，不能按“无证据即通过”处理。
 * 验证是单文件只读操作且没有锁；若 listener 正并发落盘，调用方应在完成事件之后重试，而本模块不得缓存半成品结果。
 */
import {
  resolveListenerEvidenceDir,
  resolveListenerStateDirFromEnv
} from "../listener/listenerStatePaths";
import { validatePersistedReportEventKey } from "../report/persistAuditReport";
import {
  readPersistedAuditEvidence,
  type ReadPersistedAuditEvidenceOptions,
  type ReadPersistedAuditEvidenceResult
} from "../evidence/readPersistedAuditEvidence";

type ListenerEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

export interface EvidenceVerifyCliArgs {
  eventKey: string;
  stateDir?: string;
}

export type EvidenceVerifyCliResult =
  | ReadPersistedAuditEvidenceResult
  | {
      status: "invalid_event_key";
      eventKey: string;
      message: string;
    };

export interface EvidenceVerifyCliDependencies {
  readPersistedAuditEvidence?: (
    options: ReadPersistedAuditEvidenceOptions
  ) => Promise<ReadPersistedAuditEvidenceResult>;
  writeStdout?: (line: string) => void;
}

export function parseEvidenceVerifyCliArgs(argv: string[]): EvidenceVerifyCliArgs {
  const eventKeyArgIndex = argv.indexOf("--event-key");
  const eventKey = eventKeyArgIndex >= 0 ? argv[eventKeyArgIndex + 1] : undefined;
  const stateDirArgIndex = argv.indexOf("--state-dir");
  const stateDir = stateDirArgIndex >= 0 ? argv[stateDirArgIndex + 1] : undefined;

  if (!eventKey) {
    throw new Error("Usage: npm run run:evidence:verify -- --event-key <transactionHash>:<logIndex> [--state-dir /path/to/listener-state]");
  }

  return { eventKey, stateDir };
}

function getEvidenceVerifyExitCode(result: EvidenceVerifyCliResult): number {
  return result.status === "verified" ? 0 : 1;
}

function resolveEvidenceVerifyDir(args: EvidenceVerifyCliArgs, env: ListenerEnv): string {
  return resolveListenerEvidenceDir(args.stateDir ?? resolveListenerStateDirFromEnv(env));
}

export async function runEvidenceVerifyCli(
  argv: string[],
  env: ListenerEnv,
  dependencies: EvidenceVerifyCliDependencies = {}
): Promise<number> {
  const args = parseEvidenceVerifyCliArgs(argv);
  const writeStdout = dependencies.writeStdout ?? ((line: string) => process.stdout.write(line));

  try {
    validatePersistedReportEventKey(args.eventKey);
  } catch (error) {
    const result: EvidenceVerifyCliResult = {
      status: "invalid_event_key",
      eventKey: args.eventKey,
      message:
        error instanceof Error
          ? error.message
          : "eventKey must match the current <transactionHash>:<logIndex> format"
    };
    writeStdout(`${JSON.stringify(result)}\n`);
    return getEvidenceVerifyExitCode(result);
  }

  const result = await (dependencies.readPersistedAuditEvidence ?? readPersistedAuditEvidence)({
    eventKey: args.eventKey,
    baseDir: resolveEvidenceVerifyDir(args, env)
  });

  writeStdout(`${JSON.stringify(result)}\n`);
  return getEvidenceVerifyExitCode(result);
}

if (require.main === module) {
  void runEvidenceVerifyCli(process.argv.slice(2), process.env)
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
