/**
 * 本模块通过一次 `docker info` 探测本机 CLI 与 daemon 是否可用，并把命令层错误收敛为可诊断结果；不安装/启动 Docker，也不验证镜像或运行权限范围。
 * 输入是可注入的进程执行器，输出包含 available、可选服务端版本和稳定原因码；宿主 PATH、Docker socket 与 daemon 响应均属进程外信任边界。
 * 非零退出或空版本一律视为不可用，而不是仅凭命令存在即通过；stderr/stdout 只作为诊断明细，不应被上层解析成权限事实。
 * 每次探测独立且无缓存，结果可能随 daemon 状态变化；并发调用不会共享状态，但会分别访问同一宿主服务。
 */
import type { CommandRunner } from "./dockerRunner";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface DockerAvailabilityResult {
  available: boolean;
  serverVersion?: string;
  reason?: "DOCKER_UNAVAILABLE";
  detail?: string;
}

async function defaultCommandRunner(command: string, args: string[]) {
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

export async function checkDockerAvailability(options: {
  commandRunner?: CommandRunner;
} = {}): Promise<DockerAvailabilityResult> {
  const commandRunner = options.commandRunner ?? defaultCommandRunner;
  const result = await commandRunner("docker", ["info", "--format", "{{.ServerVersion}}"]);
  const serverVersion = result.stdout.trim();
  const detail = (result.stderr || result.stdout || "unknown docker error").trim();

  if (result.exitCode !== 0 || !serverVersion) {
    return {
      available: false,
      reason: "DOCKER_UNAVAILABLE",
      detail
    };
  }

  return {
    available: true,
    serverVersion
  };
}
