/**
 * 本模块是 manifest 内容进入沙箱前的来源边界：读取本地文件或受约束的公网 URL，完成 JSON/schema 校验，并对原始字节计算 SHA-256 身份。
 * location 和远端响应均不可信；链上审计入口强制 HTTPS、禁止本地路径，远端下载复用逐跳公网 URL 校验以避免协议绕过和明显 SSRF。
 * `manifestHash` 绑定下载/读取到的精确文本而非重序列化对象，因此空白变化也会产生新身份，这是证据与证明关联必须保持的兼容不变量。
 * 读取、下载、JSON 和 schema 故障统一携带 `MANIFEST_INVALID` 语义，同时保留 cause；失败不会返回未经验证的部分 manifest。
 * 此层不验证镜像摘要或发布者签名、不缓存/写回内容，也不负责响应体配额与生命周期治理，故没有持久化回滚。
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { SandboxManifest } from "../types/manifest";
import { fetchPublicHttpUrl } from "../security/publicHttpUrl";
import { validateManifest } from "./schema";

export class ManifestValidationError extends Error {
  readonly reasonCode = "MANIFEST_INVALID";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ManifestValidationError";
  }
}

function parseManifestContents(fileContents: string): SandboxManifest {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(fileContents);
  } catch (error) {
    throw new ManifestValidationError("Manifest file is not valid JSON", { cause: error });
  }

  try {
    return validateManifest(parsedJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manifest validation failed";
    throw new ManifestValidationError(message, { cause: error });
  }
}

type ManifestLocationKind = "remote" | "unsupported_url" | "local";

function getManifestLocationKind(value: string): ManifestLocationKind {
  try {
    const parsedUrl = new URL(value);
    return ["http:", "https:"].includes(parsedUrl.protocol) ? "remote" : "unsupported_url";
  } catch {
    return "local";
  }
}

async function readManifestFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    throw new ManifestValidationError(`Unable to read manifest file: ${filePath}`, { cause: error });
  }
}

async function downloadManifestUrl(
  manifestUrl: string,
  options: LoadManifestSourceOptions = {}
): Promise<string> {
  try {
    const parsedUrl = new URL(manifestUrl);

    if (options.requireRemoteHttps && parsedUrl.protocol !== "https:") {
      throw new ManifestValidationError("Manifest URL must use https");
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new ManifestValidationError("Manifest URL must use http or https");
    }

    const response = await fetchPublicHttpUrl(parsedUrl, {
      fetchImpl: options.fetchImpl,
      requireHttps: options.requireRemoteHttps
    });
    if (!response.ok) {
      throw new ManifestValidationError(
        `Unable to download manifest URL: HTTP ${response.status}`
      );
    }

    return await response.text();
  } catch (error) {
    if (error instanceof ManifestValidationError) {
      throw error;
    }

    throw new ManifestValidationError(`Unable to download manifest URL: ${manifestUrl}`, {
      cause: error
    });
  }
}

export interface LoadedManifestSource {
  manifest: SandboxManifest;
  manifestHash: string;
  sourceContents: string;
}

export interface LoadManifestSourceOptions {
  fetchImpl?: typeof fetch;
  allowLocalFile?: boolean;
  requireRemoteHttps?: boolean;
}

export async function loadManifestSource(
  manifestLocation: string,
  options: LoadManifestSourceOptions = {}
): Promise<LoadedManifestSource> {
  const locationKind = getManifestLocationKind(manifestLocation);
  if (locationKind === "unsupported_url") {
    throw new ManifestValidationError("Manifest URL must use http or https");
  }
  if (locationKind === "local" && options.allowLocalFile === false) {
    throw new ManifestValidationError("Manifest location must be an HTTPS URL");
  }

  const sourceContents =
    locationKind === "remote"
      ? await downloadManifestUrl(manifestLocation, options)
      : await readManifestFile(manifestLocation);
  const manifest = parseManifestContents(sourceContents);

  return {
    manifest,
    manifestHash: createHash("sha256").update(sourceContents).digest("hex"),
    sourceContents
  };
}

export async function loadManifest(filePath: string): Promise<SandboxManifest> {
  return (await loadManifestSource(filePath)).manifest;
}

export async function loadManifestFromUrl(
  manifestUrl: string,
  options: LoadManifestSourceOptions = {}
): Promise<SandboxManifest> {
  return (await loadManifestSource(manifestUrl, options)).manifest;
}

export async function loadAuditChainManifestSource(
  manifestUrl: string,
  options: LoadManifestSourceOptions = {}
): Promise<LoadedManifestSource> {
  return loadManifestSource(manifestUrl, {
    ...options,
    allowLocalFile: false,
    requireRemoteHttps: true
  });
}
