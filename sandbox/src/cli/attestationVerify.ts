/**
 * 证明验证 CLI 将 eventKey 定位到 listener 的 attestation 目录，并按环境给出的 provider/measurement/quote 预期验证落盘证明；不向 TEE 请求新证明，也不修改状态文件。
 * argv、stateDir 与磁盘 JSON 都属于不可信输入，stdout 的单行结构化结果和“verified 为 0、其余为 1”的退出码是自动化合同。
 * eventKey 必须先通过当前 transactionHash:logIndex 格式校验，路径解析不得绕过 listener 目录规则；验证策略还可要求 report-data 绑定。
 * 文件缺失、内容损坏、身份不匹配或加密验证失败均应保持失败关闭；一次调用只读一个事件，无共享可变状态，也不承诺与正在写入的 listener 做快照协调。
 */
import {
  resolveListenerAttestationsDir,
  resolveListenerStateDirFromEnv
} from "../listener/listenerStatePaths";
import { validatePersistedReportEventKey } from "../report/persistAuditReport";
import {
  readPersistedAuditAttestation,
  type ReadPersistedAuditAttestationOptions,
  type ReadPersistedAuditAttestationResult
} from "../attestation/readPersistedAuditAttestation";
import { readAttestationVerifyConfig } from "../attestation/readAttestationVerifyConfig";

type ListenerEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

export interface AttestationVerifyCliArgs {
  eventKey: string;
  stateDir?: string;
}

export type AttestationVerifyCliResult =
  | ReadPersistedAuditAttestationResult
  | {
      status: "invalid_event_key";
      eventKey: string;
      message: string;
    };

export interface AttestationVerifyCliDependencies {
  readPersistedAuditAttestation?: (
    options: ReadPersistedAuditAttestationOptions
  ) => Promise<ReadPersistedAuditAttestationResult>;
  writeStdout?: (line: string) => void;
}

export function parseAttestationVerifyCliArgs(argv: string[]): AttestationVerifyCliArgs {
  const eventKeyArgIndex = argv.indexOf("--event-key");
  const eventKey = eventKeyArgIndex >= 0 ? argv[eventKeyArgIndex + 1] : undefined;
  const stateDirArgIndex = argv.indexOf("--state-dir");
  const stateDir = stateDirArgIndex >= 0 ? argv[stateDirArgIndex + 1] : undefined;

  if (!eventKey) {
    throw new Error("Usage: npm run run:attestation:verify -- --event-key <transactionHash>:<logIndex> [--state-dir /path/to/listener-state]");
  }

  return { eventKey, stateDir };
}

function getAttestationVerifyExitCode(result: AttestationVerifyCliResult): number {
  return result.status === "verified" ? 0 : 1;
}

function resolveAttestationVerifyDir(args: AttestationVerifyCliArgs, env: ListenerEnv): string {
  return resolveListenerAttestationsDir(args.stateDir ?? resolveListenerStateDirFromEnv(env));
}

export async function runAttestationVerifyCli(
  argv: string[],
  env: ListenerEnv,
  dependencies: AttestationVerifyCliDependencies = {}
): Promise<number> {
  const args = parseAttestationVerifyCliArgs(argv);
  const writeStdout = dependencies.writeStdout ?? ((line: string) => process.stdout.write(line));

  try {
    validatePersistedReportEventKey(args.eventKey);
  } catch (error) {
    const result: AttestationVerifyCliResult = {
      status: "invalid_event_key",
      eventKey: args.eventKey,
      message:
        error instanceof Error
          ? error.message
          : "eventKey must match the current <transactionHash>:<logIndex> format"
    };
    writeStdout(`${JSON.stringify(result)}\n`);
    return getAttestationVerifyExitCode(result);
  }

  const verifyConfig = readAttestationVerifyConfig(env);

  const result = await (dependencies.readPersistedAuditAttestation ?? readPersistedAuditAttestation)({
    eventKey: args.eventKey,
    baseDir: resolveAttestationVerifyDir(args, env),
    expectedVerifier: {
      providerType: verifyConfig.expectedProviderType,
      measurement: verifyConfig.expectedMeasurement,
      quoteFormat: verifyConfig.expectedQuoteFormat
    },
    verifyReportDataBinding: verifyConfig.verifyReportDataBinding
  });

  writeStdout(`${JSON.stringify(result)}\n`);
  return getAttestationVerifyExitCode(result);
}

if (require.main === module) {
  void runAttestationVerifyCli(process.argv.slice(2), process.env)
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
