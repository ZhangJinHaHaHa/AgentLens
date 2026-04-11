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

function requireConfigValue(value: string, label: string): string {
  if (!value) {
    throw new Error(`${label} is required`);
  }

  return value;
}

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

export function createLocalDirectoryReportStore(
  config: LocalDirectoryReportStoreConfig
): LocalDirectoryReportStore {
  const baseDir = requireConfigValue(config.baseDir, "baseDir");

  return {
    async putObject({ objectKey, body }): Promise<void> {
      const outputPath = resolveOutputPath(baseDir, objectKey);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, body);
    }
  };
}
