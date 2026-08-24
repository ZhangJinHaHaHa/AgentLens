import type {
  AuditWritebackSummary,
  DimensionalScoresWriteback,
  ProcessedAuditRequested
} from "./types";
import { ZERO_EVIDENCE_HASH } from "../evidence/buildAuditEvidenceEvent";

// 该参数形状与基础 AgentAuditRegistry.recordAuditResult ABI 一一对应。数字范围和 bytes32 长度
// 最终由 ABI 编码/合约校验；这里的类型主要防止字段错位，不能替代运行时的边界验证。
interface RecordAuditResultArgs {
  tokenId: bigint;
  auditScore: number;
  memoryPeakMb: number;
  cpuAvgMilli: number;
  requestIpCount: number;
  status: 1 | 2;
  manifestHash: `0x${string}`;
  reportHash: `0x${string}`;
  evidenceRoot: `0x${string}`;
  attestationHash: `0x${string}`;
  evidenceCID: string;
  reportCID: string;
  manifestUrl: string;
}

interface RecordAuditResultV2Args extends RecordAuditResultArgs {
  // V2 在基础载荷尾部追加六维 uint16 分数；不得改变顺序，否则 calldata 会产生不同协议含义。
  dimensionalScores: {
    security: number;
    taskExecution: number;
    cognitive: number;
    environment: number;
    engineering: number;
    compliance: number;
  };
}

/**
 * submitContractCall 拥有 ABI 编码、operator 签名、nonce、广播及回执确认等链上写入边界。
 * 本文件只选择方法并构造参数，不读取私钥、不持久化提交意图，也不自行重试。
 */
export interface WriteAuditResultDependencies {
  submitContractCall: (request:
    | { method: "recordAuditResult"; args: RecordAuditResultArgs }
    | { method: "recordAuditResultV2"; args: RecordAuditResultV2Args }
  ) => Promise<unknown>;
}

function mapAuditStatus(status: AuditWritebackSummary["status"]): 1 | 2 {
  // 与 AuditStatus 枚举兼容：0=Pending、1=Passed、2=Failed；Slashed/Compensated 由后续独立交易设置。
  return status === "Passed" ? 1 : 2;
}

function normalizeBytes32(value: string): `0x${string}` {
  // 内部证据哈希可为无前缀 hex；此处只补 0x，不截断、不填充也不替不可信输入做格式背书，
  // 让 ethers ABI 编码在真正的合约边界拒绝非法 bytes32。
  if (value.startsWith("0x")) {
    return value as `0x${string}`;
  }

  return `0x${value}`;
}

export async function writeAuditResult(
  processed: ProcessedAuditRequested,
  deps: WriteAuditResultDependencies
): Promise<unknown> {
  // ProcessedAuditRequested 的报告/证据落盘已经由处理阶段拥有；写回只消费其链上摘要。
  return writeAuditResultSummary(processed.writeback, deps);
}

/**
 * 将一个审计摘要提交给注册表。该操作不是本地幂等函数：合约会修改最新 Pending 记录，广播后
 * 回执不确定时不得在此盲重发；CLI 会在捕获失败后持久化意图，再由 retryWritebackQueue 读取
 * 链上字段对账。所有提交/revert/超时错误保持原样向上传播，使队列层能保存失败。
 */
export async function writeAuditResultSummary(
  summary: AuditWritebackSummary,
  deps: WriteAuditResultDependencies
): Promise<unknown> {
  const baseArgs: RecordAuditResultArgs = {
    tokenId: summary.tokenId,
    auditScore: summary.auditScore,
    memoryPeakMb: summary.memoryPeakMb,
    cpuAvgMilli: summary.cpuAvgMilli,
    requestIpCount: summary.requestIpCount,
    status: mapAuditStatus(summary.status),
    manifestHash: normalizeBytes32(summary.manifestHash),
    reportHash: normalizeBytes32(summary.reportHash),
    // 零哈希/空 CID 是“该扩展没有产物”的协议兼容哨兵，不表示验证通过或存在可信证明。
    evidenceRoot: normalizeBytes32(summary.evidenceRoot ?? ZERO_EVIDENCE_HASH),
    attestationHash: normalizeBytes32(summary.attestationHash ?? ZERO_EVIDENCE_HASH),
    evidenceCID: summary.evidenceCID ?? "",
    reportCID: summary.reportCID,
    manifestUrl: summary.manifestUrl
  };

  if (summary.dimensionalScores) {
    // 仅当调用方确实提供维度分时选择 V2 ABI；不在 V2 失败后自动降级，避免一次不确定的广播
    // 被第二种方法重复提交。目标合约版本兼容性由 runtime 配置与部署流程保证。
    return deps.submitContractCall({
      method: "recordAuditResultV2",
      args: {
        ...baseArgs,
        dimensionalScores: summary.dimensionalScores
      }
    });
  }

  // 缺少维度分的历史/基础摘要继续调用 V1 兼容入口；耐久写回队列恢复也采用这一分支。
  return deps.submitContractCall({
    method: "recordAuditResult",
    args: baseArgs
  });
}
