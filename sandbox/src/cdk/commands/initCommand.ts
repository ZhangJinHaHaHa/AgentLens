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

    const hostsRaw = await ask("Allowed hosts (comma-separated): ");
    const allowedHosts = hostsRaw
      .split(",")
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    if (allowedHosts.length === 0) {
      printError("At least one allowed host is required");
      process.exitCode = 1;
      return;
    }

    const rpcRaw = await ask("Allowed RPC endpoints (comma-separated): ");
    const allowedRpcEndpoints = rpcRaw
      .split(",")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    if (allowedRpcEndpoints.length === 0) {
      printError("At least one RPC endpoint is required");
      process.exitCode = 1;
      return;
    }

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
