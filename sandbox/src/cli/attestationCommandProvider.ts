/**
 * 该命令实现 TEE command provider 的标准输入/标准输出桥接：解析单个请求，根据模式调用演示或真实证明后端，再输出单个 JSON 响应；不充当常驻 HTTP 服务。
 * stdin、环境变量中的命令/参数及真实子进程结果均是不可信边界；stdout 仅用于协议响应，诊断必须走 stderr 以免破坏上游 JSON 解码。
 * real 模式可能启动外部可执行文件并传递请求内容，demo 模式只生成兼容形状；命令白名单、权限隔离和秘密注入由部署配置负责，而非本入口。
 * 每次进程只处理一次请求且顺序等待完成；解析、执行或序列化失败均返回非零退出状态，不得输出部分成功对象供调用方误用。
 */
import {
  generateDemoCommandAttestation,
  generateRealCommandAttestation,
  parseCommandAttestationRequest
} from "../attestation/commandProviderBackend";

async function readStdin(): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    process.stdin.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    process.stdin.on("error", reject);
  });
}

export interface AttestationCommandProviderCliDependencies {
  writeStdout?: (chunk: string) => void;
  readStdin?: () => Promise<string>;
  runCommand?: (input: {
    file: string;
    args: string[];
    stdin: string;
  }) => Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
}

export async function runAttestationCommandProviderCli(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  stdinText?: string,
  dependencies: AttestationCommandProviderCliDependencies = {}
): Promise<number> {
  const readInput =
    stdinText !== undefined ? async () => stdinText : dependencies.readStdin ?? readStdin;
  const writeStdout = dependencies.writeStdout ?? ((chunk: string) => process.stdout.write(chunk));

  const request = parseCommandAttestationRequest(await readInput());
  const response =
    env.TEE_COMMAND_PROVIDER_MODE === "real"
      ? await generateRealCommandAttestation(request, {
          command: env.TEE_COMMAND_PROVIDER_COMMAND || "",
          args: (env.TEE_COMMAND_PROVIDER_ARGS || "")
            .split(/\r?\n/u)
            .flatMap((line) => line.split(","))
            .map((value) => value.trim())
            .filter((value) => value.length > 0),
          runCommand: dependencies.runCommand
        })
      : await generateDemoCommandAttestation(request, {
          quoteFormat: env.TEE_COMMAND_PROVIDER_QUOTE_FORMAT
        });

  writeStdout(JSON.stringify(response));
  return 0;
}

if (require.main === module) {
  void runAttestationCommandProviderCli(process.env).catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
