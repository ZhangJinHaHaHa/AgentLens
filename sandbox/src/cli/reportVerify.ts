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
