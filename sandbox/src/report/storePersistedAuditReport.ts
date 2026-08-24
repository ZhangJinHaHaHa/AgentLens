import { readFile } from "node:fs/promises";

import type { AuditRequestedEvent, StoredAuditReportIdentifiers } from "../listener/types";
import type { AuditReportArtifact } from "./buildAuditReport";
import type { PersistedAuditReportArtifact } from "./persistAuditReport";

export interface StorePersistedAuditReportOptions {
  event: AuditRequestedEvent;
  reportArtifact: AuditReportArtifact;
  reportPersistence: PersistedAuditReportArtifact;
  cosKeyPrefix?: string;
}

export interface RemoteReportStorageDeps {
  putObject(input: {
    objectKey: string;
    body: Buffer;
    contentType: "application/json";
  }): Promise<void>;
  addToIpfs(input: { body: Buffer; fileName: string }): Promise<{ cid: string }>;
}

/**
 * 远端键只能由稳定的 ASCII 路径段组成。该转换是有损的，不能单独承担事件唯一性；
 * 完整对象键还包含 tokenId 与内容哈希，而上游正常路径也已用严格事件键格式限制输入。
 */
function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]/g, "-");
}

function buildSanitizedEventKeySegment(eventKey: string): string {
  return sanitizePathSegment(eventKey);
}

// COS 与本地目录适配器共享同一对象键协议，保证切换后端时报告命名层级保持兼容。
function buildCosObjectKey(
  event: AuditRequestedEvent,
  reportArtifact: AuditReportArtifact,
  keyPrefix: string
): string {
  const sanitizedEventKey = buildSanitizedEventKeySegment(event.eventKey);
  return `${keyPrefix}/${event.tokenId.toString()}/${sanitizedEventKey}/${reportArtifact.reportHash}.json`;
}

// 上传文件名仅是 multipart 元数据；IPFS 内容身份最终由完全相同的 `body` 字节决定。
function buildIpfsFileName(
  event: AuditRequestedEvent,
  reportArtifact: AuditReportArtifact
): string {
  const sanitizedEventKey = buildSanitizedEventKeySegment(event.eventKey);
  return `${event.tokenId.toString()}-${sanitizedEventKey}-${reportArtifact.reportHash}.json`;
}

/**
 * 把已经成功落盘的报告复制到对象存储和 IPFS。磁盘文件而非内存中的 `reportJson`
 * 是双写的唯一事实来源，确保两个后端接收同一快照，并避免报告对象在持久化后被修改造成漂移。
 *
 * 写入顺序固定为对象存储后 IPFS，二者不构成分布式事务：COS 失败会阻止 IPFS 调用；
 * IPFS 失败则可能留下已写入的 COS 对象，且本函数不回滚、不内部重试。上层若重放，
 * 确定性对象键和内容寻址使“相同字节”可安全重复提交，但后端覆盖/版本策略仍由各适配器负责。
 */
export async function storePersistedAuditReport(
  options: StorePersistedAuditReportOptions,
  deps: RemoteReportStorageDeps
): Promise<StoredAuditReportIdentifiers> {
  // 读取发生在远端副作用之前；本地文件缺失或不可读时不会产生半套远端状态。
  const reportBytes = await readFile(options.reportPersistence.reportFilePath);
  const normalizedPrefix = (options.cosKeyPrefix ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  const cosObjectKey = buildCosObjectKey(
    options.event,
    options.reportArtifact,
    normalizedPrefix || "reports"
  );

  await deps.putObject({
    objectKey: cosObjectKey,
    body: reportBytes,
    contentType: "application/json"
  });

  // 只有对象存储确认成功后才进入 IPFS；任一异常原样上抛，由监听器记录 storage failed 状态。
  const ipfsResult = await deps.addToIpfs({
    body: reportBytes,
    fileName: buildIpfsFileName(options.event, options.reportArtifact)
  });

  // 两端均成功后才发布标识，避免调用方把仅完成一侧的结果写回链上。
  return {
    reportCid: ipfsResult.cid,
    cosObjectKey
  };
}
