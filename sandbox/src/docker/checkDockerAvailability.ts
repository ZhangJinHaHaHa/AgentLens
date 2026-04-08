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
