/**
 * `init` 命令负责通过一次交互会话收集最小 manifest、复用正式 schema 校验并写入指定文件；不拉取镜像、不验证网络可达性，也不注册上链。
 * 用户输入和 output 路径是不可信进程边界，成功输出是带尾换行的 JSON 文件及后续操作提示；写文件是本命令唯一持久副作用。
 * 名称、镜像和网络声明在落盘前必须通过本地规则与共享 schema，任一失败设置非零 exitCode 且不应产生有效 manifest。
 * readline 会话无论成功、提前返回或抛错都必须关闭；命令按单会话串行提问，不支持并发写同一路径，调用方需负责避免覆盖竞争。
 */
import fs from "node:fs";
import path from "node:path";

import { validateManifest } from "../../manifest/schema";
import { createPromptSession, type PromptUserOptions } from "../util/promptUser";
import { printSuccess, printError, printInfo, dim } from "../util/formatOutput";

const AGENT_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export interface InitCommandDeps {
  askUser?: (question: string) => Promise<string>;
}

export interface InitCommandOptions {
  output?: string;
  promptOptions?: PromptUserOptions;
  deps?: InitCommandDeps;
}

export async function runInitCommand(options: InitCommandOptions): Promise<void> {
  let ask: (question: string) => Promise<string>;
  let cleanup: () => void;

  if (options.deps?.askUser) {
    ask = options.deps.askUser;
    cleanup = () => {};
  } else {
    const session = createPromptSession(options.promptOptions);
    ask = (q) => session.ask(q);
    cleanup = () => session.close();
  }

  try {
    printInfo("Create a new agent manifest\n");

    const agentName = await ask("Agent name (alphanumeric, hyphens, underscores): ");
    if (!AGENT_NAME_PATTERN.test(agentName)) {
      printError("agent_name must match ^[a-zA-Z0-9_-]{1,64}$");
      process.exitCode = 1;
      return;
    }

    const image = await ask("Docker image URL: ");
    if (!image) {
      printError("image cannot be empty");
      process.exitCode = 1;
      return;
    }

    const hostsRaw = await ask("Allowed hosts (comma-separated, blank for no network access): ");
    const allowedHosts = hostsRaw
      .split(",")
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    const rpcRaw = await ask("Allowed RPC endpoints (comma-separated, blank for none): ");
    const allowedRpcEndpoints = rpcRaw
      .split(",")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const manifestData = {
      agent_name: agentName,
      image,
      allowed_hosts: allowedHosts,
      allowed_rpc_endpoints: allowedRpcEndpoints
    };

    try {
      validateManifest(manifestData);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      printError(`Manifest validation failed: ${message}`);
      process.exitCode = 1;
      return;
    }

    const outputPath = options.output ?? path.join(process.cwd(), "manifest.json");
    const contents = JSON.stringify(manifestData, null, 2) + "\n";
    fs.writeFileSync(outputPath, contents, "utf8");

    printSuccess(`Manifest written to ${outputPath}`);
    process.stdout.write("\n");
    printInfo(`Next steps:`);
    printInfo(`  1. ${dim("shenji-cdk validate --manifest " + outputPath)}`);
    printInfo(`  2. ${dim("shenji-cdk register --manifest-url <url> --agent-name " + agentName)}`);
  } finally {
    cleanup();
  }
}
