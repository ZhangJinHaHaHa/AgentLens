/**
 * 该探针在已运行容器内依次选择 curl、wget 或 busybox wget，对指定 URL 做五秒可达性试验；不修改防火墙，也不证明目标内容可信或连接始终允许。
 * containerId、targetUrl 与子进程结果跨越容器执行边界；URL 在进入 `sh -lc` 前必须按单引号规则转义，避免把探测目标解释成额外命令。
 * 输出区分“可达”“不可达但有工具”和“无探测工具”，使验收逻辑不会把 exit 127 误当作成功阻断；其他网络/TLS/HTTP 失败统一表现为不可达。
 * 单次调用只执行一个探测且无重试、无共享状态；它观察当下路径，不能单独保证并发连接或后续 DNS 变化下的出口策略。
 */
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
