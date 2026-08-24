/**
 * `validate` 命令验证本地 manifest 的可读性、JSON/schema 合法性与内容 SHA-256，并按显式 --docker 选项追加容器烟测；不发布文件、不注册链上资产。
 * manifest 路径是不可信文件边界，成功输出包含规范字段与对原始字节计算的哈希；Docker 模式还会启动外部进程和短生命周期容器。
 * 文件读取、JSON 解析、schema 校验分别映射为稳定的人类可读失败并设置非零 exitCode，只有烟测自身的结构化结果决定 Docker 阶段是否通过。
 * 哈希必须覆盖原始文本以保持与被验证内容一致；两阶段按顺序执行，schema 失败时不得触发镜像或容器副作用。
 */
import crypto from "node:crypto";
import fs from "node:fs";

import { validateManifest } from "../../manifest/schema";
import { runDockerSmokeCheck } from "../../runtime/runDockerSmokeCheck";
import { printSuccess, printError, printInfo, printKeyValue, printHeader, dim } from "../util/formatOutput";

export interface ValidateCommandOptions {
  manifest?: string;
  docker: boolean;
}

export async function runValidateCommand(options: ValidateCommandOptions): Promise<void> {
  const manifestPath = options.manifest ?? "manifest.json";

  let contents: string;
  try {
    contents = fs.readFileSync(manifestPath, "utf8");
  } catch {
    printError(`Cannot read manifest file: ${manifestPath}`);
    process.exitCode = 1;
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    printError("Manifest is not valid JSON");
    process.exitCode = 1;
    return;
  }

  try {
    const manifest = validateManifest(parsed);

    const hash = crypto.createHash("sha256").update(contents).digest("hex");

    printHeader("Manifest Validation");
    printSuccess("Schema validation passed");
    printKeyValue("Agent Name", manifest.agent_name);
    printKeyValue("Image", manifest.image);
    printKeyValue("Allowed Hosts", manifest.allowed_hosts.join(", "));
    printKeyValue("RPC Endpoints", manifest.allowed_rpc_endpoints.join(", "));
    printKeyValue("SHA-256", dim(hash));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    printError(`Validation failed: ${message}`);
    process.exitCode = 1;
    return;
  }

  if (options.docker) {
    process.stdout.write("\n");
    printInfo("Running Docker smoke check...");

    const result = await runDockerSmokeCheck({ manifestPath });

    if (result.healthcheckPassed) {
      printSuccess("Docker smoke check passed");
    } else {
      printError(`Docker smoke check failed: ${result.reasonCode ?? "unknown"}`);
      if (result.detail) {
        printInfo(result.detail);
      }
      process.exitCode = 1;
    }
  }
}
