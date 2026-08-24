import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import type { AuditEvidenceChainContext } from "./evidenceChain";
import { validatePersistedReportEventKey, buildPersistedReportEventKeyFragment } from "../report/persistAuditReport";

export interface PersistAuditEvidenceOptions {
  eventKey: string;
  tokenId: bigint | string;
  chain: AuditEvidenceChainContext;
  baseDir?: string;
}

// 返回路径是本地持久化定位信息；evidenceRoot 才是供报告或链上记录引用的内容标识。
export interface PersistedAuditEvidenceArtifact {
  evidenceFilePath: string;
  evidenceFileName: string;
  evidenceRoot: string;
}

function buildEvidenceFileName(options: PersistAuditEvidenceOptions): string {
  // 复用报告 eventKey 校验规则，使两类产物可按同一 <txHash>:<logIndex> 兼容键关联，并阻断路径分隔符注入。
  validatePersistedReportEventKey(options.eventKey);
  return `${options.tokenId.toString()}-${buildPersistedReportEventKeyFragment(options.eventKey)}-${options.chain.evidenceRoot}.json`;
}

function buildEvidenceJson(options: PersistAuditEvidenceOptions): string {
  // 这里序列化的是调用时的链快照；事件只保存 payloadHash，不复制可能含敏感信息的原始 payload。
  return JSON.stringify(
    {
      schemaVersion: "audit-evidence-stream.v1",
      eventKey: options.eventKey,
      tokenId: options.tokenId.toString(),
      eventCount: options.chain.events.length,
      evidenceRoot: options.chain.evidenceRoot,
      events: options.chain.events
    },
    null,
    2
  );
}

export async function persistAuditEvidence(
  options: PersistAuditEvidenceOptions
): Promise<PersistedAuditEvidenceArtifact> {
  // baseDir 是受信配置边界，path.resolve 只规范化路径而不限制其落点，不应直接接收远端用户输入。
  const baseDir = path.resolve(options.baseDir ?? path.join(process.cwd(), ".runtime", "evidence"));
  const evidenceFileName = buildEvidenceFileName(options);
  const evidenceFilePath = path.join(baseDir, evidenceFileName);
  const tempFilePath = path.join(baseDir, `${evidenceFileName}.${randomUUID()}.tmp`);
  const evidenceJson = buildEvidenceJson(options);

  await mkdir(baseDir, { recursive: true });
  // 随机临时名隔离并发写入；最终文件与临时文件位于同一目录，保证 hard link 不跨文件系统。
  await writeFile(tempFilePath, evidenceJson, "utf8");

  try {
    // link 是“不覆盖发布”：只有一个写者能创建最终路径，读者不会观察到正在写入的半个 JSON 文件。
    await link(tempFilePath, evidenceFilePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }

    const existing = await readFile(evidenceFilePath, "utf8");
    // 同名且逐字节相同视为幂等重试；同一事件键/根却内容不同则显式冲突，禁止静默覆盖审计证据。
    if (existing !== evidenceJson) {
      throw new Error(`evidence file conflict at ${evidenceFilePath}`);
    }
  } finally {
    // 正常失败路径都会清理本次临时文件；进程被强制终止时可能残留随机 .tmp，运维清理不得触碰 .json 正式产物。
    await rm(tempFilePath, { force: true });
  }

  return {
    evidenceFilePath,
    evidenceFileName,
    evidenceRoot: options.chain.evidenceRoot
  };
}
