import fs from "node:fs";
import path from "node:path";

import type { CdkConfig } from "./cdkTypes";

const DEFAULT_RPC_URL = "http://203.91.76.159:18545";
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
