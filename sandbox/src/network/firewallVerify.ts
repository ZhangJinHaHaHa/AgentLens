import { execFile } from "node:child_process";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { promisify } from "node:util";

import { resolveFirewallPlan, type HostResolver } from "./firewallPlan";
import type { SandboxManifest } from "../types/manifest";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export interface FirewallVerificationResult {
  configured: boolean;
  missingRules: string[];
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

function normalizeRule(command: string): string {
  return command.replace(/^iptables\s+/, "");
}

function canonicalizeRule(rule: string): string {
  let normalized = normalizeRule(rule);

  normalized = normalized.replace(
    /(--ctstate )([A-Z_,]+)/,
    (_match, prefix: string, states: string) => `${prefix}${states.split(",").sort().join(",")}`
  );
  normalized = normalized.replace(/-d (\d+\.\d+\.\d+\.\d+)\/32\b/g, "-d $1");
  normalized = normalized.replace(/-m (udp|tcp)\b\s*/g, "");
  normalized = normalized.replace(
    /-A OUTPUT -d (\d+\.\d+\.\d+\.\d+) -p (udp|tcp) --dport 53 -j ACCEPT/,
    "-A OUTPUT -p $2 -d $1 --dport 53 -j ACCEPT"
  );

  return normalized;
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

export async function verifyFirewallRules(
  containerId: string,
  manifest: SandboxManifest,
  options: {
    commandRunner?: CommandRunner;
    resolveHost?: HostResolver;
    getDnsServers?: (containerId: string) => Promise<string[]>;
  } = {}
): Promise<FirewallVerificationResult> {
  const commandRunner = options.commandRunner ?? defaultCommandRunner;
  const resolveHost =
    options.resolveHost ??
    (async (host: string) => {
      const results = await lookup(host, { all: true, family: 4 });
      return [...new Set(results.map((result) => result.address))].sort();
    });
  const getDnsServers =
    options.getDnsServers ??
    (async (currentContainerId: string) => {
      const resolvConfResult = await commandRunner("docker", [
        "exec",
        currentContainerId,
        "cat",
        "/etc/resolv.conf"
      ]);

      if (resolvConfResult.exitCode !== 0) {
        throw new Error(
          `Failed to read container resolv.conf: ${resolvConfResult.stderr || resolvConfResult.stdout}`
        );
      }

      return parseResolvConf(resolvConfResult.stdout);
    });
  const result = await commandRunner("docker", ["exec", containerId, "iptables", "-S", "OUTPUT"]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to verify firewall rules: ${result.stderr || result.stdout}`);
  }

  const actualRules = new Set(
    result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(canonicalizeRule)
  );
  const expectedRules = (
    await resolveFirewallPlan(manifest, {
      resolveHost,
      dnsServers: await getDnsServers(containerId)
    })
  ).commands
    .map((rule) => ({
      original: normalizeRule(rule),
      canonical: canonicalizeRule(rule)
    }))
    .filter((rule) => rule.original !== "-F OUTPUT");
  const missingRules = expectedRules
    .filter((rule) => !actualRules.has(rule.canonical))
    .map((rule) => rule.original);

  return {
    configured: missingRules.length === 0,
    missingRules
  };
}
