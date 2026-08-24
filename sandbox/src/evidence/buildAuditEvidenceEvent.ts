import { createHash } from "node:crypto";

// v1 链以 64 个零作为创世前驱；该哨兵已进入落盘格式，变更会破坏既有证据根的可重算性。
export const ZERO_EVIDENCE_HASH = "0".repeat(64);

export type AuditEvidenceStage =
  | "audit_requested_observed"
  | "manifest_fetched"
  | "manifest_validated"
  | "container_started"
  | "healthcheck_passed"
  | "audit_request_sent"
  | "audit_response_received"
  | "resource_usage_collected"
  | "network_activity_collected"
  | "report_built";

export interface AuditEvidenceEvent {
  // schemaVersion 参与事件哈希，既是解析版本也是防止不同版本字段被误当成同一事件的域分隔符。
  schemaVersion: "audit-evidence.v1";
  eventKey: string;
  tokenId: string;
  sequence: number;
  stage: AuditEvidenceStage;
  timestamp: string;
  prevHash: string;
  payloadHash: string;
  eventHash: string;
}

/**
 * 为哈希提供与对象属性插入顺序无关的 JSON 表示：对象键递归排序，数组顺序保持不变。
 * 输入合同是普通、可 JSON 序列化的数据树；BigInt、循环引用或依赖原型语义的对象会失败或丢失语义，
 * 应在进入证据边界前转换。此规范化规则属于 v1 兼容合同，不能在不升版本的情况下替换。
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)])
    );
  }

  return value;
}

function hashCanonicalValue(value: unknown): string {
  // SHA-256 在此用于篡改检测和内容寻址，不含密钥，不能证明事件由某个可信主体签发。
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export function computeEvidencePayloadHash(payload: unknown): string {
  return hashCanonicalValue(payload);
}

export function computeAuditEvidenceEventHash(input: {
  eventKey: string;
  tokenId: string;
  sequence: number;
  stage: AuditEvidenceStage;
  timestamp: string;
  prevHash: string;
  payloadHash: string;
}): string {
  // 原始 payload 不重复进入事件哈希；payloadHash 是载荷与链结构之间的唯一绑定点。
  return hashCanonicalValue({
    schemaVersion: "audit-evidence.v1",
    eventKey: input.eventKey,
    tokenId: input.tokenId,
    sequence: input.sequence,
    stage: input.stage,
    timestamp: input.timestamp,
    prevHash: input.prevHash,
    payloadHash: input.payloadHash
  });
}

export function buildAuditEvidenceEvent(input: {
  eventKey: string;
  tokenId: string;
  sequence: number;
  stage: AuditEvidenceStage;
  timestamp: string;
  prevHash: string;
  payload: unknown;
}): AuditEvidenceEvent {
  // 构建器是纯计算且不持有状态；sequence、timestamp 与 prevHash 的连续性由 evidenceChain 的所有者维护。
  const payloadHash = computeEvidencePayloadHash(input.payload);
  const eventHash = computeAuditEvidenceEventHash({
    eventKey: input.eventKey,
    tokenId: input.tokenId,
    sequence: input.sequence,
    stage: input.stage,
    timestamp: input.timestamp,
    prevHash: input.prevHash,
    payloadHash
  });

  return {
    // 调用方提供的标识与时间戳按原值固化。跨信任边界使用前仍需验证格式、时钟来源和业务归属。
    schemaVersion: "audit-evidence.v1",
    eventKey: input.eventKey,
    tokenId: input.tokenId,
    sequence: input.sequence,
    stage: input.stage,
    timestamp: input.timestamp,
    prevHash: input.prevHash,
    payloadHash,
    eventHash
  };
}
