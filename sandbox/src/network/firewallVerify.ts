/**
 * 防火墙验证器重新解析期望计划、读取容器实际 `iptables -S OUTPUT`，经有限规范化后报告缺失规则；不写规则、不做数据包级穿透测试，也不证明宿主防火墙安全。
 * containerId、manifest、DNS、resolv.conf 与 docker 输出均跨越外部信任边界；命令失败或 DNS 无法解析必须抛错，不能以空规则集宣告已配置。
 * 规范化只消除 conntrack 状态顺序、/32 与协议模块等已知表示差异，仍要求每条安全相关期望规则存在；额外规则不会在此判为失败。
 * DNS 和实际规则分步读取，不构成原子快照，验证期间的并发规则变更可能影响结果；configured 仅代表采样时缺失集合为空。
 */
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
