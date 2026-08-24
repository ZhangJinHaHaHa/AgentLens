/**
 * 该适配器把受配置管理的本地可执行程序包装为 `TeeProvider`，以 JSON stdin/stdout 维持与 HTTP provider 相同的证明结果契约。
 * 请求来自审计流水线，命令与参数来自部署配置，而 stdout 是不可信的进程外数据；只有四个必填字段归一化并通过 quoteValidator 后才可返回。
 * 默认 runner 不经 shell 启动子进程，退出码、启动错误、JSON 解码及校验失败均直接向调用者传播，绝不降级为看似成功的 mock 证明。
 * 进程生命周期可由注入的 runner 接管；默认 runner 当前不消费 timeoutMs，本层也不重试、不保存证明，外部监督者必须限制悬挂进程且无法回滚命令副作用。
 * validator 可注入是为了组合硬件/策略校验与测试替身，并不改变“未经校验的 stdout 不能越过此边界”的不变量。
 */
import { spawn } from "node:child_process";

import type { AttestationRequest, TeeProvider } from "./mockTeeProvider";
import {
  createNoopAttestationQuoteValidator,
  type AttestationQuoteValidator
} from "./attestationQuoteValidator";

export interface CommandTeeProviderConfig {
  command: string;
  args?: string[];
  providerType: string;
  timeoutMs: number;
  quoteValidator?: AttestationQuoteValidator;
  quoteValidation?: {
    expectedProviderType?: string;
    expectedMeasurement?: string;
    expectedQuoteFormat?: string;
  };
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

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required in attestation response`);
  }

  return value;
}

async function defaultRunCommand(input: {
  file: string;
  args: string[];
  stdin: string;
}): Promise<{
  stdout: string;
    stderr: string;
    exitCode: number;
}> {
  return await new Promise((resolve, reject) => {
    const child = spawn(input.file, input.args, {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1
      });
    });

    child.stdin.write(input.stdin);
    child.stdin.end();
  });
}

export function createCommandTeeProvider(config: CommandTeeProviderConfig): TeeProvider {
  const runCommand = config.runCommand ?? defaultRunCommand;
  const quoteValidator = config.quoteValidator ?? createNoopAttestationQuoteValidator();

  return {
    async attest(input: AttestationRequest) {
      const result = await runCommand({
        file: config.command,
        args: config.args ?? [],
        stdin: JSON.stringify(input)
      });

      if (result.exitCode !== 0) {
        throw new Error(
          `command TEE provider failed with exit code ${result.exitCode}: ${result.stderr || result.stdout}`
        );
      }

      const payload = JSON.parse(result.stdout) as {
        measurement?: unknown;
        quoteFormat?: unknown;
        sessionPublicKey?: unknown;
        quote?: unknown;
      };

      const normalized = {
        measurement: requireString(payload.measurement, "measurement"),
        quoteFormat: requireString(payload.quoteFormat, "quoteFormat"),
        sessionPublicKey: requireString(payload.sessionPublicKey, "sessionPublicKey"),
        quote: requireString(payload.quote, "quote")
      };

      await quoteValidator.validate({
        providerType: config.providerType,
        ...normalized
      });

      return normalized;
    }
  };
}
