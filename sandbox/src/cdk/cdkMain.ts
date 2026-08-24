#!/usr/bin/env node
/**
 * 这是 shenji-cdk 的进程入口，只负责把 argv 路由到 init、validate、register、status 命令并统一映射终端退出状态，不承载各命令的领域规则。
 * 输入边界是未经解析的命令行参数，输出边界是 stdout/stderr 与 process.exitCode；帮助文本也是用户可依赖的 CLI 合同。
 * 子命令可能进一步访问文件、Docker、RPC 或签名账户，但本层不自行执行这些副作用，也不吞掉未预期异常。
 * 命令按单次进程串行调度；缺参或未知命令必须以非零退出码结束，异步失败须保留堆栈信息，避免自动化脚本把失败误判为成功。
 */

import { runInitCommand } from "./commands/initCommand";
import { runValidateCommand } from "./commands/validateCommand";
import { runRegisterCommand } from "./commands/registerCommand";
import { runStatusCommand } from "./commands/statusCommand";
import { bold, dim } from "./util/formatOutput";

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function printUsage(): void {
  process.stdout.write(`
${bold("shenji-cdk")} — Agent developer toolkit for Shenji audit platform

${bold("Commands:")}
  ${bold("init")}       ${dim("Interactive manifest creation")}
  ${bold("validate")}   ${dim("Validate manifest and optionally smoke-test Docker image")}
  ${bold("register")}   ${dim("Register agent on-chain (stake)")}
  ${bold("status")}     ${dim("Query audit status for a token")}
  ${bold("help")}       ${dim("Show this help")}

${bold("Examples:")}
  shenji-cdk init --output ./manifest.json
  shenji-cdk validate --manifest ./manifest.json --docker
  shenji-cdk register --manifest-url https://example.com/manifest.json --agent-name my-agent
  shenji-cdk status --token-id 1 --watch

${bold("Configuration:")}
  Config file: ${dim("shenji-cdk.config.json")} (in cwd)
  Env vars:    ${dim("SHENJI_CDK_RPC_URL, SHENJI_CDK_CHAIN_ID, SHENJI_CDK_REGISTRY_ADDRESS, SHENJI_CDK_PRIVATE_KEY")}

`);
}

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case "init": {
      await runInitCommand({
        output: getArg("--output")
      });
      break;
    }

    case "validate": {
      await runValidateCommand({
        manifest: getArg("--manifest"),
        docker: hasFlag("--docker")
      });
      break;
    }

    case "register": {
      const manifestUrl = getArg("--manifest-url");
      const agentName = getArg("--agent-name");
      const stake = getArg("--stake");

      if (!manifestUrl || !agentName) {
        process.stderr.write("Usage: shenji-cdk register --manifest-url <url> --agent-name <name> [--stake <eth>]\n");
        process.exitCode = 1;
        return;
      }

      await runRegisterCommand({ manifestUrl, agentName, stake });
      break;
    }

    case "status": {
      const tokenId = getArg("--token-id");
      if (!tokenId) {
        process.stderr.write("Usage: shenji-cdk status --token-id <id> [--watch]\n");
        process.exitCode = 1;
        return;
      }

      await runStatusCommand({ tokenId, watch: hasFlag("--watch") });
      break;
    }

    case "help":
    case "--help":
    case "-h":
    case undefined: {
      printUsage();
      break;
    }

    default: {
      process.stderr.write(`Unknown command: ${command}\n`);
      printUsage();
      process.exitCode = 1;
    }
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
