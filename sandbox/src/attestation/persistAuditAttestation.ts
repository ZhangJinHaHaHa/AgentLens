/**
 * 本模块把已构建的证明 bundle 作为只增制品写入本地文件系统，文件名绑定 token、规范化 eventKey 与内容哈希。
 * eventKey 和目标目录是路径信任边界：前者复用报告层校验规则，后者解析为绝对路径；bundleJson/hash 被视为上游已经一致校验的输入。
 * 临时文件写完后以硬链接原子发布，目标不存在时绝不覆盖；同名同内容视为幂等成功，同名异内容则报告冲突以保护审计历史不变量。
 * 无论发布成功、冲突或 I/O 失败都会尝试清理临时文件，但已发布的不可变目标不会在后续错误中回滚删除。
 * 此层不重算哈希、不验证 quote，也不负责跨主机事务、保留期或备份策略。
 */
import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { buildPersistedReportEventKeyFragment, validatePersistedReportEventKey } from "../report/persistAuditReport";
import type { AuditAttestationArtifact } from "./buildAuditAttestation";

export interface PersistAuditAttestationOptions {
  eventKey: string;
  tokenId: bigint | string;
  attestationArtifact: AuditAttestationArtifact;
  baseDir?: string;
}

export interface PersistedAuditAttestationArtifact {
  attestationFilePath: string;
  attestationFileName: string;
  attestationHash: string;
}

function buildAttestationFileName(options: PersistAuditAttestationOptions): string {
  validatePersistedReportEventKey(options.eventKey);
  return `${options.tokenId.toString()}-${buildPersistedReportEventKeyFragment(options.eventKey)}-${options.attestationArtifact.attestationHash}.json`;
}

export async function persistAuditAttestation(
  options: PersistAuditAttestationOptions
): Promise<PersistedAuditAttestationArtifact> {
  const baseDir = path.resolve(options.baseDir ?? path.join(process.cwd(), ".runtime", "attestations"));
  const attestationFileName = buildAttestationFileName(options);
  const attestationFilePath = path.join(baseDir, attestationFileName);
  const tempFilePath = path.join(baseDir, `${attestationFileName}.${randomUUID()}.tmp`);

  await mkdir(baseDir, { recursive: true });
  await writeFile(tempFilePath, options.attestationArtifact.bundleJson, "utf8");

  try {
    await link(tempFilePath, attestationFilePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }

    const existing = await readFile(attestationFilePath, "utf8");
    if (existing !== options.attestationArtifact.bundleJson) {
      throw new Error(`attestation file conflict at ${attestationFilePath}`);
    }
  } finally {
    await rm(tempFilePath, { force: true });
  }

  return {
    attestationFilePath,
    attestationFileName,
    attestationHash: options.attestationArtifact.attestationHash
  };
}
