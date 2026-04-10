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
