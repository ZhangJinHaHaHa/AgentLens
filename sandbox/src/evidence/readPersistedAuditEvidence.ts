import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  computeAuditEvidenceEventHash,
  type AuditEvidenceStage
} from "./buildAuditEvidenceEvent";
import { buildPersistedReportEventKeyFragment, validatePersistedReportEventKey } from "../report/persistAuditReport";

export interface ReadPersistedAuditEvidenceOptions {
  eventKey: string;
  baseDir?: string;
}

export type ReadPersistedAuditEvidenceResult =
  // 可预期的数据状态用判别联合返回；目录权限、JSON 语法等基础设施错误仍通过异常暴露。
  | {
      status: "verified";
      eventKey: string;
      evidenceFilePath: string;
      evidenceRoot: string;
    }
  | {
      status: "not_found";
      eventKey: string;
    }
  | {
      status: "hash_mismatch";
      eventKey: string;
      evidenceFilePath: string;
      expectedEvidenceRoot: string;
      actualEvidenceRoot: string;
    }
  | {
      status: "conflict";
      eventKey: string;
      matches: string[];
    };

interface PersistedEvidenceFile {
  schemaVersion: "audit-evidence-stream.v1";
  eventKey: string;
  tokenId: string;
  eventCount: number;
  evidenceRoot: string;
  events: Array<{
    schemaVersion: "audit-evidence.v1";
    eventKey: string;
    tokenId: string;
    sequence: number;
    stage: AuditEvidenceStage;
    timestamp: string;
    prevHash: string;
    payloadHash: string;
    eventHash: string;
  }>;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function recomputeEvidenceRoot(payload: PersistedEvidenceFile): string {
  // v1 根定义为最后一个事件字段的重算哈希；空事件流得到空字符串，因而不会被误报为有效的零根证据。
  let latestEventHash = "";

  for (const event of payload.events) {
    latestEventHash = computeAuditEvidenceEventHash({
      eventKey: event.eventKey,
      tokenId: event.tokenId,
      sequence: event.sequence,
      stage: event.stage,
      timestamp: event.timestamp,
      prevHash: event.prevHash,
      payloadHash: event.payloadHash
    });
  }

  return latestEventHash;
}

export async function readPersistedAuditEvidence(
  options: ReadPersistedAuditEvidenceOptions
): Promise<ReadPersistedAuditEvidenceResult> {
  // 查询键先走与写路径相同的格式校验，确保文件匹配规则不会被不可信正则或路径片段扩展。
  validatePersistedReportEventKey(options.eventKey);

  const baseDir = path.resolve(options.baseDir ?? path.join(process.cwd(), ".runtime", "evidence"));
  const eventKeyFragment = buildPersistedReportEventKeyFragment(options.eventKey);
  const expectedNamePattern = new RegExp(
    // 文件名格式是持久化索引合同：十进制 tokenId + 兼容 eventKey 片段 + 64 位 evidenceRoot。
    `^\\d+-${escapeRegex(eventKeyFragment)}-([0-9a-fA-F]{64})\\.json$`
  );

  let entries: string[];
  try {
    entries = await readdir(baseDir, { withFileTypes: false });
  } catch (error) {
    // 只有目录不存在等价于业务上的 not_found；权限、I/O 等故障必须上抛，避免把不可用伪装成无数据。
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "not_found", eventKey: options.eventKey };
    }
    throw error;
  }

  const matches = entries
    .map((entry) => {
      const match = entry.match(expectedNamePattern);
      if (!match || !match[1]) {
        return undefined;
      }
      return {
        evidenceFilePath: path.join(baseDir, entry),
        expectedEvidenceRoot: match[1]
      };
    })
    .filter(
      (entry): entry is { evidenceFilePath: string; expectedEvidenceRoot: string } =>
        entry !== undefined
    )
    .sort((left, right) => left.evidenceFilePath.localeCompare(right.evidenceFilePath));

  if (matches.length === 0) {
    return { status: "not_found", eventKey: options.eventKey };
  }

  if (matches.length > 1) {
    // 同一 eventKey 出现多个候选时拒绝任选其一；排序后的完整路径让调用方能稳定诊断和人工处置冲突。
    return {
      status: "conflict",
      eventKey: options.eventKey,
      matches: matches.map((match) => match.evidenceFilePath)
    };
  }

  const match = matches[0];
  // 落盘 JSON 属于不可信输入：语法错误会抛出，类型声明只是编译期视图，不提供运行时 schema 验证。
  const parsed = JSON.parse(await readFile(match.evidenceFilePath, "utf8")) as PersistedEvidenceFile;
  const actualEvidenceRoot = recomputeEvidenceRoot(parsed);

  if (
    actualEvidenceRoot !== match.expectedEvidenceRoot.toLowerCase() ||
    parsed.evidenceRoot.toLowerCase() !== match.expectedEvidenceRoot.toLowerCase() ||
    parsed.eventCount !== parsed.events.length
  ) {
    return {
      status: "hash_mismatch",
      eventKey: options.eventKey,
      evidenceFilePath: match.evidenceFilePath,
      expectedEvidenceRoot: match.expectedEvidenceRoot,
      actualEvidenceRoot
    };
  }

  /**
   * `verified` 的现有含义仅限于：末事件重算根、文件名根、payload.evidenceRoot 与 eventCount 相互一致。
   * SHA-256 不提供签名身份；本实现也未逐项核对已存 eventHash、相邻 prevHash、sequence、eventKey 或 tokenId。
   * 扩大验证语义时应新增明确版本/兼容策略，调用方当前不得把该状态解释为来源认证或完整业务授权。
   */
  return {
    status: "verified",
    eventKey: options.eventKey,
    evidenceFilePath: match.evidenceFilePath,
    evidenceRoot: match.expectedEvidenceRoot
  };
}
