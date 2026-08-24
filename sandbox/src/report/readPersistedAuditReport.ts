import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { computeAuditReportHash } from "./buildAuditReport";
import {
  buildPersistedReportEventKeyFragment,
  validatePersistedReportEventKey
} from "./persistAuditReport";

export interface ReadPersistedAuditReportOptions {
  eventKey: string;
  baseDir?: string;
}

/**
 * 读取接口用判别联合表达可审计的业务状态：缺失、内容损坏和多候选冲突都不是同一种失败。
 * 非法调用参数以及权限、磁盘等操作故障仍以异常传播，避免被误报成“没有报告”。
 */
export type ReadPersistedAuditReportResult =
  | {
      status: "verified";
      eventKey: string;
      reportFilePath: string;
      reportHash: string;
    }
  | {
      status: "not_found";
      eventKey: string;
    }
  | {
      status: "hash_mismatch";
      eventKey: string;
      reportFilePath: string;
      expectedReportHash: string;
      actualReportHash: string;
    }
  | {
      status: "conflict";
      eventKey: string;
      matches: string[];
    };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 按事件键查找并验证本地报告，但不解析或升级报告 JSON。
 * 因此 v1/v2 内容在此处保持透明兼容；本模块只拥有“文件命名身份与原始字节哈希一致”
 * 这一不变量，不把 SHA-256 完整性检查误当作签名、发布者认证或业务字段验证。
 */
export async function readPersistedAuditReport(
  options: ReadPersistedAuditReportOptions
): Promise<ReadPersistedAuditReportResult> {
  validatePersistedReportEventKey(options.eventKey);

  const baseDir = path.resolve(options.baseDir ?? path.join(process.cwd(), ".runtime", "reports"));
  const eventKeyFragment = buildPersistedReportEventKeyFragment(options.eventKey);
  // tokenId 不作为查询条件：事件键是查询身份，文件名中的 64 位十六进制段则声明预期内容哈希。
  const expectedNamePattern = new RegExp(
    `^\\d+-${escapeRegex(eventKeyFragment)}-([0-9a-fA-F]{64})\\.json$`
  );

  let entries: string[];
  try {
    entries = await readdir(baseDir, { withFileTypes: false });
  } catch (error) {
    // 尚未创建存储目录等价于业务上的无结果；其他 I/O 错误需要上抛给调用方决定告警或重试。
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        status: "not_found",
        eventKey: options.eventKey
      };
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
        filePath: path.join(baseDir, entry),
        expectedReportHash: match[1]
      };
    })
    .filter((entry): entry is { filePath: string; expectedReportHash: string } => entry !== undefined)
    // 排序使冲突清单跨文件系统保持确定性，便于 CLI 输出、测试和人工处置复现。
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  if (matches.length === 0) {
    return {
      status: "not_found",
      eventKey: options.eventKey
    };
  }

  if (matches.length > 1) {
    // 同一事件出现多个内容身份时拒绝自行挑选，即使其中某个文件哈希有效也不能掩盖分叉状态。
    return {
      status: "conflict",
      eventKey: options.eventKey,
      matches: matches.map((match) => match.filePath)
    };
  }

  const match = matches[0];
  // 必须对磁盘原始文本计算哈希；解析后重排字段或空白会改变被持久化的内容身份。
  const reportJson = await readFile(match.filePath, "utf8");
  const actualReportHash = computeAuditReportHash(reportJson);

  if (actualReportHash !== match.expectedReportHash.toLowerCase()) {
    return {
      status: "hash_mismatch",
      eventKey: options.eventKey,
      reportFilePath: match.filePath,
      expectedReportHash: match.expectedReportHash,
      actualReportHash
    };
  }

  return {
    status: "verified",
    eventKey: options.eventKey,
    reportFilePath: match.filePath,
    reportHash: match.expectedReportHash
  };
}
