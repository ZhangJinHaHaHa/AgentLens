import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import type { AuditRequestedEvent } from "../listener/types";
import type { AuditReportArtifact } from "./buildAuditReport";

export interface PersistAuditReportOptions {
  event: AuditRequestedEvent;
  reportArtifact: AuditReportArtifact;
  baseDir?: string;
}

export interface PersistedAuditReportArtifact {
  reportFilePath: string;
  reportFileName: string;
}

/**
 * `eventKey` 同时参与报告、证据和证明文件的命名，是跨模块持久化兼容契约。
 * 当前只接受链上交易哈希样式的十六进制前缀与十进制日志索引；若未来扩展事件来源，
 * 必须同步迁移所有读写方，不能只放宽某一个文件的解析规则。
 */
export const VALID_EVENT_KEY_PATTERN = /^0x[0-9a-fA-F]+:\d+$/;

export function validatePersistedReportEventKey(eventKey: string): void {
  if (!VALID_EVENT_KEY_PATTERN.test(eventKey)) {
    throw new Error("eventKey must match the current <transactionHash>:<logIndex> format");
  }
}

export function buildPersistedReportEventKeyFragment(eventKey: string): string {
  validatePersistedReportEventKey(eventKey);
  // 校验先于替换，确保冒号是唯一需要转换的路径不安全分隔符，而非通用“清洗”入口。
  return eventKey.replaceAll(":", "-");
}

/**
 * 文件名把 token、事件唯一键和报告内容哈希组合为确定性身份。这里信任
 * `reportArtifact` 来自 `buildAuditReport`；若绕过构建器手工传入不一致的哈希与 JSON，
 * 写入阶段不会重新计算，之后的读取校验会以文件名中的哈希报告不一致。
 */
export function buildPersistedReportFileName(
  event: AuditRequestedEvent,
  reportArtifact: AuditReportArtifact
): string {
  validatePersistedReportEventKey(event.eventKey);

  return `${event.tokenId.toString()}-${buildPersistedReportEventKeyFragment(event.eventKey)}-${reportArtifact.reportHash}.json`;
}

/**
 * 将报告以“唯一临时文件 -> 原子硬链接”的方式提交到本地持久化目录。
 * 硬链接相当于 create-if-absent：并发或重试写入同一确定性目标时只有一个创建者成功，
 * 其余写入者在 `EEXIST` 分支比较完整字节；相同内容视为幂等成功，不同内容则显式冲突，
 * 从而避免静默覆盖同一事件/哈希身份。函数自身不循环重试，调用方可依赖上述语义安全重放。
 */
export async function persistAuditReport(
  options: PersistAuditReportOptions
): Promise<PersistedAuditReportArtifact> {
  const baseDir = path.resolve(options.baseDir ?? path.join(process.cwd(), ".runtime", "reports"));
  const reportFileName = buildPersistedReportFileName(options.event, options.reportArtifact);
  const reportFilePath = path.join(baseDir, reportFileName);
  // 临时文件与目标位于同一目录，既保证 `link` 不跨文件系统，也隔离并发调用的清理所有权。
  const tempFilePath = path.join(baseDir, `${reportFileName}.${randomUUID()}.tmp`);

  await mkdir(baseDir, { recursive: true });
  // 写入完成后才进入原子提交；若此处 I/O 失败或进程崩溃，可能遗留 `.tmp`，但读取器的文件名规则会忽略它。
  await writeFile(tempFilePath, options.reportArtifact.reportJson, "utf8");

  try {
    await link(tempFilePath, reportFilePath);
  } catch (error) {
    // 只有“目标已存在”属于可判定的重放；权限、磁盘和文件系统能力错误均保留原始失败语义。
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }

    const existing = await readFile(reportFilePath, "utf8");

    if (existing !== options.reportArtifact.reportJson) {
      throw new Error(`report file conflict at ${reportFilePath}`);
    }
  } finally {
    // 进入提交阶段后，无论提交、幂等命中或失败都只清理本次 UUID 临时文件；已提交目标不在清理范围。
    await rm(tempFilePath, { force: true });
  }

  return {
    reportFilePath,
    reportFileName
  };
}
