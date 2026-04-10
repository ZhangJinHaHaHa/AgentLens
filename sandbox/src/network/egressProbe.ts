import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export interface EgressProbeResult {
  reachable: boolean;
  toolAvailable: boolean;
}

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

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildProbeCommand(targetUrl: string): string {
  const escapedUrl = shellEscape(targetUrl);

  return [
    `if command -v curl >/dev/null 2>&1; then curl -fsS -o /dev/null --max-time 5 ${escapedUrl};`,
    `elif command -v wget >/dev/null 2>&1; then wget -q -T 5 -O /dev/null ${escapedUrl};`,
    `elif command -v busybox >/dev/null 2>&1; then busybox wget -q -T 5 -O /dev/null ${escapedUrl};`,
    "else exit 127;",
    "fi"
  ].join(" ");
}

export async function probeEgress(
  containerId: string,
  targetUrl: string,
  options: { commandRunner?: CommandRunner } = {}
): Promise<EgressProbeResult> {
  const commandRunner = options.commandRunner ?? defaultCommandRunner;
  const result = await commandRunner("docker", [
    "exec",
    containerId,
    "sh",
    "-lc",
    buildProbeCommand(targetUrl)
  ]);

  if (result.exitCode === 0) {
    return {
      reachable: true,
      toolAvailable: true
    };
  }

  if (result.exitCode === 127) {
    return {
      reachable: false,
      toolAvailable: false
    };
  }

  return {
    reachable: false,
    toolAvailable: true
  };
}
