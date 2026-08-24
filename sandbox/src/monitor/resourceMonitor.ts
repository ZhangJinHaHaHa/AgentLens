/**
 * 资源监视器对一次 `docker stats --no-stream` 输出进行单位规范化，向审计器提供 CPU 千分单位与 MiB 近似内存值；不持续采样，也不执行 Docker 配额。
 * containerId 和命令文本跨越宿主进程信任边界，解析仅接受约定的百分比及 KiB/MiB/GiB 格式，非零退出或格式漂移必须显式失败。
 * cpuAvgMilli 表示该次 Docker 百分比换算，memoryPeakMb 名称沿用结果合同但来源是单点 used memory；调用方不得据此声称掌握真实全程峰值。
 * 函数无共享状态且每次启动独立子进程，可并发调用；Docker 版本的格式模板与单位换算是兼容不变量，舍入保持整数输出。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface ResourceUsage {
  cpuAvgMilli: number;
  memoryPeakMb: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

const execFileAsync = promisify(execFile);

async function defaultCommandRunner(command: string, args: string[]): Promise<CommandResult> {
  try {
    const result = await execFileAsync(command, args, { encoding: "utf8" });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0
    };
  } catch (error) {
    const commandError = error as Error & { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: commandError.stdout ?? "",
      stderr: commandError.stderr ?? commandError.message,
      exitCode: commandError.code ?? 1
    };
  }
}

function parseCpuToMilli(cpuText: string): number {
  const value = Number.parseFloat(cpuText.replace("%", "").trim());
  if (Number.isNaN(value)) {
    throw new Error("Unable to parse docker CPU percentage");
  }

  return Math.round(value * 10);
}

function parseMemoryToMb(memoryText: string): number {
  const match = memoryText.trim().match(/^([\d.]+)\s*(KiB|MiB|GiB)$/i);
  if (!match) {
    throw new Error("Unable to parse docker memory usage");
  }

  const value = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === "kib") {
    return Math.round(value / 1024);
  }

  if (unit === "mib") {
    return Math.round(value);
  }

  return Math.round(value * 1024);
}

export function parseDockerStatsLine(line: string): ResourceUsage {
  const [cpuPart, memoryPart] = line.trim().split(";");
  if (!cpuPart || !memoryPart) {
    throw new Error("Unexpected docker stats output");
  }

  const [usedMemory] = memoryPart.split("/");
  if (!usedMemory) {
    throw new Error("Unexpected docker memory output");
  }

  return {
    cpuAvgMilli: parseCpuToMilli(cpuPart),
    memoryPeakMb: parseMemoryToMb(usedMemory)
  };
}

export async function collectResourceUsage(
  containerId: string,
  options: { commandRunner?: CommandRunner } = {}
): Promise<ResourceUsage> {
  const commandRunner = options.commandRunner ?? defaultCommandRunner;
  const result = await commandRunner("docker", [
    "stats",
    "--no-stream",
    "--format",
    "{{.CPUPerc}};{{.MemUsage}}",
    containerId
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to collect docker stats: ${result.stderr || result.stdout}`);
  }

  return parseDockerStatsLine(result.stdout);
}
