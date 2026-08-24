/**
 * 这是命令式证明后端的协议适配层：解析标准 v1 stdin 请求，并把受部署配置控制的可执行程序 stdout 归一化为四个证明字段。
 * 命令路径和参数属于运维信任域，stdin 请求及子进程 stdout 属于跨进程边界；使用 `spawn` 参数数组而非 shell 字符串，避免在本层引入命令拼接语义。
 * 非零退出码、无效 JSON 或任一空字段都会使调用失败，stderr 仅用于保留诊断上下文；本层不重试，也无法撤销外部程序已经执行的副作用。
 * demo 生成器只提供确定性的协议占位值，不能代表硬件证明或安全通过，真实模式必须依赖外部后端的证明实现。
 * 此文件不校验 quote 的密码学有效性、不持久化制品，调用方仍须在接受输出前应用对应 validator。
 */
import type { AttestationRequest } from "./mockTeeProvider";
import { spawn } from "node:child_process";

function requireString(value: unknown, field: keyof AttestationRequest): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }

  return value;
}

export function parseCommandAttestationRequest(raw: string): AttestationRequest {
  const parsed = JSON.parse(raw) as Partial<AttestationRequest>;
  if (parsed.schemaVersion !== "audit-attestation-request.v1") {
    throw new Error("schemaVersion must be audit-attestation-request.v1");
  }

  return {
    schemaVersion: "audit-attestation-request.v1",
    eventKey: requireString(parsed.eventKey, "eventKey"),
    tokenId: requireString(parsed.tokenId, "tokenId"),
    manifestHash: requireString(parsed.manifestHash, "manifestHash"),
    evidenceRoot: requireString(parsed.evidenceRoot, "evidenceRoot"),
    manifestUrl: requireString(parsed.manifestUrl, "manifestUrl")
  };
}

export async function generateDemoCommandAttestation(
  _input: AttestationRequest,
  options: { quoteFormat?: string } = {}
): Promise<{
  measurement: string;
  quoteFormat: string;
  sessionPublicKey: string;
  quote: string;
}> {
  return {
    measurement: "a".repeat(64),
    quoteFormat: options.quoteFormat ?? "mock-quote",
    sessionPublicKey: "mock-session-public-key",
    quote: "mock-attestation-quote"
  };
}

function requireResponseString(value: unknown, field: string): string {
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

export async function generateRealCommandAttestation(
  input: AttestationRequest,
  options: {
    command: string;
    args?: string[];
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
): Promise<{
  measurement: string;
  quoteFormat: string;
  sessionPublicKey: string;
  quote: string;
}> {
  const runCommand = options.runCommand ?? defaultRunCommand;
  const result = await runCommand({
    file: options.command,
    args: options.args ?? [],
    stdin: JSON.stringify(input)
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `command attestation backend failed with exit code ${result.exitCode}: ${result.stderr || result.stdout}`
    );
  }

  const payload = JSON.parse(result.stdout) as {
    measurement?: unknown;
    quoteFormat?: unknown;
    sessionPublicKey?: unknown;
    quote?: unknown;
  };

  return {
    measurement: requireResponseString(payload.measurement, "measurement"),
    quoteFormat: requireResponseString(payload.quoteFormat, "quoteFormat"),
    sessionPublicKey: requireResponseString(payload.sessionPublicKey, "sessionPublicKey"),
    quote: requireResponseString(payload.quote, "quote")
  };
}
