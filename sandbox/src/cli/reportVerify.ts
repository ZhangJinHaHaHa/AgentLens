/**
 * 报告验证 CLI 从事件键解析 listener 报告目录并校验已落盘报告的绑定关系与完整性；不访问报告网关、不重新执行审计，也不更新验证标记。
 * argv/stateDir/磁盘文件均是不可信输入，结果以单行 JSON 输出；退出码严格由 status 是否为 verified 决定，便于 CI 与运维脚本失败关闭。
 * eventKey 在路径拼接前必须满足当前 transactionHash:logIndex 协议，非法值返回稳定业务结果而非尝试任意文件读取。
 * 调用为无锁只读，可能与 listener 原子落盘时序相遇；文件缺失、内容不完整或哈希不一致均不得降级为成功，必要时由上层在写入完成后重试。
 */
import {
  resolveListenerReportsDir,
  resolveListenerStateDirFromEnv
} from "../listener/listenerStatePaths";
import { validatePersistedReportEventKey } from "../report/persistAuditReport";
import {
  readPersistedAuditReport,
  type ReadPersistedAuditReportOptions,
  type ReadPersistedAuditReportResult
} from "../report/readPersistedAuditReport";

type ListenerEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

export interface ReportVerifyCliArgs {
  eventKey: string;
  stateDir?: string;
}

export type ReportVerifyCliResult =
  | ReadPersistedAuditReportResult
  | {
      status: "invalid_event_key";
      eventKey: string;
      message: string;
    };

export interface ReportVerifyCliDependencies {
  readPersistedAuditReport?: (
    options: ReadPersistedAuditReportOptions
  ) => Promise<ReadPersistedAuditReportResult>;
  writeStdout?: (line: string) => void;
}

export function parseReportVerifyCliArgs(argv: string[]): ReportVerifyCliArgs {
  const eventKeyArgIndex = argv.indexOf("--event-key");
  const eventKey = eventKeyArgIndex >= 0 ? argv[eventKeyArgIndex + 1] : undefined;
  const stateDirArgIndex = argv.indexOf("--state-dir");
  const stateDir = stateDirArgIndex >= 0 ? argv[stateDirArgIndex + 1] : undefined;

  if (!eventKey) {
    throw new Error("Usage: npm run run:report:verify -- --event-key <transactionHash>:<logIndex> [--state-dir /path/to/listener-state]");
  }

  return {
    eventKey,
    stateDir
  };
}

export function resolveReportVerifyReportsDir(args: ReportVerifyCliArgs, env: ListenerEnv): string {
  const resolvedStateDir = args.stateDir ?? resolveListenerStateDirFromEnv(env);
  return resolveListenerReportsDir(resolvedStateDir);
}

export function getReportVerifyExitCode(result: ReportVerifyCliResult): number {
  return result.status === "verified" ? 0 : 1;
}

export async function runReportVerifyCli(
  argv: string[],
  env: ListenerEnv,
  dependencies: ReportVerifyCliDependencies = {}
): Promise<number> {
  const args = parseReportVerifyCliArgs(argv);
  const writeStdout = dependencies.writeStdout ?? ((line: string) => process.stdout.write(line));

  try {
    validatePersistedReportEventKey(args.eventKey);
  } catch (error) {
    const result: ReportVerifyCliResult = {
      status: "invalid_event_key",
      eventKey: args.eventKey,
      message:
        error instanceof Error
          ? error.message
          : "eventKey must match the current <transactionHash>:<logIndex> format"
    };
    writeStdout(`${JSON.stringify(result)}\n`);
    return getReportVerifyExitCode(result);
  }

  const reportsDir = resolveReportVerifyReportsDir(args, env);
  const result = await (dependencies.readPersistedAuditReport ?? readPersistedAuditReport)({
    eventKey: args.eventKey,
    baseDir: reportsDir
  });

  writeStdout(`${JSON.stringify(result)}\n`);
  return getReportVerifyExitCode(result);
}

if (require.main === module) {
  void runReportVerifyCli(process.argv.slice(2), process.env)
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
