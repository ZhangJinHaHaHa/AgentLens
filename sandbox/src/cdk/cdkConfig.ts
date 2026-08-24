/**
 * CDK 配置边界：把调用进程的工作目录与环境变量归并为链访问配置，不负责探测节点、校验合约部署或保管密钥。
 * 输入可能来自可编辑的 JSON 文件和进程环境；输出只保留调用方所需的规范字段，并维持“环境变量覆盖文件、文件覆盖默认值”的兼容优先级。
 * 本模块会同步读取本地文件，文件缺失、不可读或非对象 JSON 均按空配置降级；显式但非法的 chainId 则必须失败，避免静默连接错误网络。
 * privateKey 跨越秘密信任边界但不会在此写盘或输出；并发调用彼此无共享状态，结果只取决于各次传入的 cwd/env 与当时文件内容。
 */
import fs from "node:fs";
import path from "node:path";

import type { CdkConfig } from "./cdkTypes";

const DEFAULT_RPC_URL = "http://127.0.0.1:18545";
const DEFAULT_CHAIN_ID = 302612;
const DEFAULT_REGISTRY_ADDRESS = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";

const CONFIG_FILE_NAME = "shenji-cdk.config.json";

interface RawConfigFile {
  rpcUrl?: unknown;
  chainId?: unknown;
  registryAddress?: unknown;
}

function readConfigFile(directory: string): RawConfigFile {
  const filePath = path.join(directory, CONFIG_FILE_NAME);

  try {
    const contents = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(contents) as Record<string, unknown>;

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as RawConfigFile;
  } catch {
    return {};
  }
}

export function loadCdkConfig(options: { cwd?: string; env?: Record<string, string | undefined> } = {}): CdkConfig {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;

  const fileConfig = readConfigFile(cwd);

  const rpcUrl =
    env.SHENJI_CDK_RPC_URL ??
    (typeof fileConfig.rpcUrl === "string" ? fileConfig.rpcUrl : undefined) ??
    DEFAULT_RPC_URL;

  const chainIdRaw =
    env.SHENJI_CDK_CHAIN_ID ??
    (typeof fileConfig.chainId === "number" ? String(fileConfig.chainId) : undefined);

  const chainId = chainIdRaw !== undefined ? Number.parseInt(chainIdRaw, 10) : DEFAULT_CHAIN_ID;

  if (!Number.isFinite(chainId) || chainId <= 0) {
    throw new Error(`Invalid chainId: ${chainIdRaw}`);
  }

  const registryAddress =
    env.SHENJI_CDK_REGISTRY_ADDRESS ??
    (typeof fileConfig.registryAddress === "string" ? fileConfig.registryAddress : undefined) ??
    DEFAULT_REGISTRY_ADDRESS;

  const privateKey = env.SHENJI_CDK_PRIVATE_KEY ?? undefined;

  return { rpcUrl, chainId, registryAddress, privateKey };
}
