import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { promisify } from "node:util";

import { DEFAULT_CPU, DEFAULT_MEMORY_MB, PORT } from "../config/constants";
import { buildEgressPolicy } from "../network/egressPolicy";
import { resolveFirewallPlan, type HostResolver } from "../network/firewallPlan";
import type { SandboxManifest } from "../types/manifest";

const execFileAsync = promisify(execFile);

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export interface StartedContainer {
  containerId: string;
  host: string;
  port: number;
}

export interface DockerRunnerOptions {
  commandRunner?: CommandRunner;
  hostPort?: number;
  memoryMb?: number;
  cpuCount?: number;
  resolveHost?: HostResolver;
  getDnsServers?: (containerId: string) => Promise<string[]>;
  networkName?: string;
}

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

async function runDockerCommand(
  args: string[],
  commandRunner: CommandRunner,
  failureMessage: string
): Promise<CommandResult> {
  const result = await commandRunner("docker", args);

  if (result.exitCode !== 0) {
    throw new Error(`${failureMessage}: ${result.stderr || result.stdout || "unknown docker error"}`);
  }

  return result;
}

function isMissingContainerError(result: CommandResult): boolean {
  return (result.stderr || result.stdout).includes("No such container");
}

function parseResolvConf(text: string): string[] {
  return [...new Set(
    text
      .split("\n")
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts[0] === "nameserver" && parts[1] && isIP(parts[1]) === 4)
      .map((parts) => parts[1] as string)
  )].sort();
}

async function defaultGetDnsServers(
  containerId: string,
  commandRunner: CommandRunner
): Promise<string[]> {
  const result = await commandRunner("docker", ["exec", containerId, "cat", "/etc/resolv.conf"]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to read container resolv.conf: ${result.stderr || result.stdout}`);
  }

  return parseResolvConf(result.stdout);
}

async function applyFirewallPlan(
  containerId: string,
  manifest: SandboxManifest,
  commandRunner: CommandRunner,
  resolveHost: HostResolver,
  getDnsServers: (containerId: string) => Promise<string[]>
): Promise<void> {
  try {
    const firewallPlan = await resolveFirewallPlan(manifest, {
      resolveHost,
      dnsServers: await getDnsServers(containerId)
    });

    for (const command of firewallPlan.commands) {
      await runDockerCommand(
        ["exec", containerId, "sh", "-lc", command],
        commandRunner,
        "Failed to apply firewall rules"
      );
    }
  } catch (error) {
    await runDockerCommand(["rm", "-f", containerId], commandRunner, "Failed to remove container");
    throw error;
  }
}

export async function startContainer(
  manifest: SandboxManifest,
  options: DockerRunnerOptions = {}
): Promise<StartedContainer> {
  const hostPort = options.hostPort ?? PORT;
  const memoryMb = options.memoryMb ?? DEFAULT_MEMORY_MB;
  const cpuCount = options.cpuCount ?? DEFAULT_CPU;
  const commandRunner = options.commandRunner ?? defaultCommandRunner;
  const egressPolicy = buildEgressPolicy(manifest);
  const resolveHost =
    options.resolveHost ??
    (async (host: string) => {
      const results = await lookup(host, { all: true, family: 4 });
      return [...new Set(results.map((result) => result.address))].sort();
    });
  const getDnsServers =
    options.getDnsServers ??
    ((containerId: string) => defaultGetDnsServers(containerId, commandRunner));

  const networkName = options.networkName;
  const containerName = networkName
    ? `shenji-audit-${randomUUID().slice(0, 8)}`
    : undefined;

  const networkArgs: string[] = networkName
    ? ["--network", networkName, "--name", containerName!]
    : ["-p", `${hostPort}:${PORT}`];

  const result = await runDockerCommand(
    [
      "run",
      "-d",
      "--rm",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--cap-add",
        "NET_ADMIN",
        "--security-opt",
        "no-new-privileges",
        "--pids-limit",
      "128",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=64m",
      "--memory",
      `${memoryMb}m`,
      "--cpus",
      `${cpuCount}`,
      "-e",
      `SANDBOX_ALLOWED_HOSTS=${egressPolicy.allowedHosts.join(",")}`,
      "-e",
      `SANDBOX_ALLOWED_RPC_ENDPOINTS=${egressPolicy.allowedRpcEndpoints.join(",")}`,
      "-e",
      `SANDBOX_DENIED_CIDRS=${egressPolicy.deniedCidrs.join(",")}`,
      ...networkArgs,
      manifest.image
    ],
    commandRunner,
    "Failed to start container"
  );

  const containerId = result.stdout.trim();
  await applyFirewallPlan(containerId, manifest, commandRunner, resolveHost, getDnsServers);

  return networkName
    ? { containerId, host: containerName!, port: PORT }
    : { containerId, host: "127.0.0.1", port: hostPort };
}

export async function pullImage(
  manifest: SandboxManifest,
  options: Pick<DockerRunnerOptions, "commandRunner"> = {}
): Promise<void> {
  const commandRunner = options.commandRunner ?? defaultCommandRunner;
  const inspectResult = await commandRunner("docker", ["image", "inspect", manifest.image]);

  if (inspectResult.exitCode === 0) {
    return;
  }

  await runDockerCommand(["pull", manifest.image], commandRunner, "Failed to pull image");
}

export async function stopContainer(
  containerId: string,
  options: Pick<DockerRunnerOptions, "commandRunner"> = {}
): Promise<void> {
  const commandRunner = options.commandRunner ?? defaultCommandRunner;
  const result = await commandRunner("docker", ["stop", containerId]);

  if (result.exitCode !== 0 && !isMissingContainerError(result)) {
    throw new Error(`Failed to stop container: ${result.stderr || result.stdout || "unknown docker error"}`);
  }
}

export async function removeContainer(
  containerId: string,
  options: Pick<DockerRunnerOptions, "commandRunner"> = {}
): Promise<void> {
  const commandRunner = options.commandRunner ?? defaultCommandRunner;
  const result = await commandRunner("docker", ["rm", "-f", containerId]);

  if (result.exitCode !== 0 && !isMissingContainerError(result)) {
    throw new Error(`Failed to remove container: ${result.stderr || result.stdout || "unknown docker error"}`);
  }
}

export async function killContainer(
  containerId: string,
  options: Pick<DockerRunnerOptions, "commandRunner"> = {}
): Promise<void> {
  const commandRunner = options.commandRunner ?? defaultCommandRunner;
  const result = await commandRunner("docker", ["kill", containerId]);

  if (result.exitCode !== 0 && !isMissingContainerError(result)) {
    throw new Error(`Failed to kill container: ${result.stderr || result.stdout || "unknown docker error"}`);
  }
}
