import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

export interface LocalDirectoryReportStoreConfig {
  baseDir: string;
}

export interface LocalDirectoryReportStore {
  putObject(input: {
    objectKey: string;
    body: Buffer;
    contentType: "application/json";
  }): Promise<void>;
}

// `baseDir` 是部署方拥有的存储根配置；空值在构造适配器时失败，避免延迟到首次写入。
function requireConfigValue(value: string, label: string): string {
  if (!value) {
    throw new Error(`${label} is required`);
  }

  return value;
}

/**
 * 把对象存储键映射为本地路径时执行词法范围约束。`objectKey` 通常由报告编排层生成，
 * 但仍先规范化并剥离前导 `..`，防止其直接逃逸配置根目录。该检查不解析符号链接，
 * 因此 `baseDir` 及其已有目录结构必须由受信任的运维边界管理，不能暴露给攻击者布置链接。
 */
function resolveOutputPath(baseDir: string, objectKey: string): string {
  const normalizedKey = normalize(objectKey).replace(/^(\.\.(\/|\\|$))+/, "");
  const outputPath = join(baseDir, normalizedKey);
  const normalizedBaseDir = join(baseDir, ".");
  const normalizedOutputPath = join(outputPath, ".");

  if (!normalizedOutputPath.startsWith(normalizedBaseDir)) {
    throw new Error("objectKey must stay within the configured baseDir");
  }

  return outputPath;
}

/**
 * 本地适配器实现与 COS 相同的 `putObject` 形状，供本地端到端环境复用远端编排路径。
 * 实例本身不保存写入状态；文件系统拥有最终字节。相同键会被 `writeFile` 覆盖，故只有
 * “确定性键 + 相同内容”的重放才具有业务幂等性，本层不做版本比较、事务或自动重试。
 */
export function createLocalDirectoryReportStore(
  config: LocalDirectoryReportStoreConfig
): LocalDirectoryReportStore {
  const baseDir = requireConfigValue(config.baseDir, "baseDir");

  return {
    async putObject({ objectKey, body }): Promise<void> {
      const outputPath = resolveOutputPath(baseDir, objectKey);
      // 递归建目录允许并发创建同一路径；随后写入不是临时文件提交，进程崩溃时可能留下部分文件。
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, body);
    }
  };
}
