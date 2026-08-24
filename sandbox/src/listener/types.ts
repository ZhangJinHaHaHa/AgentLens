import type { AuditReportArtifact } from "../report/buildAuditReport";
import type {
  PersistAuditReportOptions,
  PersistedAuditReportArtifact
} from "../report/persistAuditReport";
import type {
  PersistAuditEvidenceOptions,
  PersistedAuditEvidenceArtifact
} from "../evidence/persistAuditEvidence";
import type {
  CreateAuditAttestationInput,
  CreateAuditAttestationResult
} from "../attestation/buildAuditAttestation";
import type {
  PersistAuditAttestationOptions,
  PersistedAuditAttestationArtifact
} from "../attestation/persistAuditAttestation";
import type { LoadedManifestSource } from "../manifest/loadManifest";
import type { AuditSolveRequest, LocalAuditResult, SandboxManifest } from "../types/manifest";
import type { AuditEvidenceEvent, AuditEvidenceStage } from "../evidence/buildAuditEvidenceEvent";

/**
 * 由 AuditRequested 日志规范化出的 listener 输入。eventKey 在当前实现中是
 * `transactionHash:logIndex`，是内存去重及三个耐久重试队列的共同幂等键；tokenId 在运行时保留
 * bigint 精度，进入 JSON 队列时再显式转为十进制字符串。字段源自 RPC/链上载荷，清单 URL 和
 * 名称仍须在加载边界验证；blockNumber 也不等同于已达到最终性的区块。
 */
export interface AuditRequestedEvent {
  eventKey: string;
  tokenId: bigint;
  developer: string;
  agentName: string;
  manifestUrl: string;
  blockNumber: number;
  transactionHash: string;
}

export interface ListenerWritebackDisabledConfig {
  enabled: false;
}

/**
 * 启用写回时，签名密钥和 chainId 只用于服务端构造写客户端，不应进入事件、报告或队列文件。
 * 判别字段 enabled 使禁用配置在类型层面无法携带一个被误认为生效的私钥。
 */
export interface ListenerWritebackEnabledConfig {
  enabled: true;
  operatorPrivateKey: string;
  chainId: number;
}

export type ListenerWritebackConfig =
  | ListenerWritebackDisabledConfig
  | ListenerWritebackEnabledConfig;

/**
 * 运行沙箱的一次性调用契约。manifestLocation 位于外部输入边界，其解析、下载与网络策略由
 * runAudit 实现负责；emitEvidence 只追加当前执行的证据事件，不拥有最终证据/报告的持久化。
 */
export interface RunAuditForEventOptions {
  manifestLocation: string;
  request: AuditSolveRequest;
  emitEvidence?: (event: { stage: AuditEvidenceStage; payload: unknown; timestamp?: string }) => Promise<void>;
}

/**
 * 六维分按当前 V2 合约的 basis-point 约定写入（0..10000，uint16）。TypeScript 的 number 不约束
 * 范围，分数生成器和 ABI/合约边界共同负责拒绝越界值，调用方不得把 0..100 原始分直接传入。
 */
export interface DimensionalScoresWriteback {
  security: number;
  taskExecution: number;
  cognitive: number;
  environment: number;
  engineering: number;
  compliance: number;
}

/**
 * 审计完成后准备提交合约的内存模型。哈希在此阶段允许无 0x 前缀，写入适配器统一规范化；
 * optional 证据字段缺失时会编码为 bytes32(0)/空字符串。dimensionalScores 的存在选择
 * recordAuditResultV2，不存在则保持基础 recordAuditResult 兼容路径。
 */
export interface AuditWritebackSummary {
  tokenId: bigint;
  auditScore: number;
  memoryPeakMb: number;
  cpuAvgMilli: number;
  requestIpCount: number;
  status: "Passed" | "Failed";
  manifestHash: string;
  reportHash: string;
  evidenceRoot?: string;
  attestationHash?: string;
  evidenceCID?: string;
  reportCID: string;
  manifestUrl: string;
  dimensionalScores?: DimensionalScoresWriteback;
}

export interface StoredAuditReportIdentifiers {
  // reportCid 是内容寻址标识，cosObjectKey 是对象存储定位键；两者只说明落储结果，不替代哈希校验。
  reportCid: string;
  cosObjectKey: string;
}

// 这是允许产生资金处罚的封闭协议集合；扩展该联合类型必须同步审查 slashPolicy 与 bytes32 编码。
export type SlashReasonCode = "UNDECLARED_EGRESS" | "ACTION_MISMATCH";

/**
 * 外部报告存储是独立故障域。failed 保留原审计结论以便观测，但处理流程会把最终 auditResult
 * 转为可重试的 REPORT_STORAGE_FAILED；error 仅用于诊断，不应承载凭据或完整远端响应。
 */
export interface ProcessedReportStorageSummary {
  outcome: "skipped" | "stored" | "failed";
  cosObjectKey?: string;
  error?: string;
  originalAuditStatus?: string;
  originalAuditReasonCode?: string | null;
}

export interface PersistedAuditWritebackSummary {
  status: AuditWritebackSummary["status"];
  auditScore: number;
  memoryPeakMb: number;
  cpuAvgMilli: number;
  requestIpCount: number;
  manifestHash: `0x${string}`;
  reportHash: `0x${string}`;
  evidenceRoot?: `0x${string}`;
  attestationHash?: `0x${string}`;
  evidenceCID?: string;
  reportCID: string;
  manifestUrl: string;
}

/**
 * 耐久写回队列的最小 JSON schema。pending 可自动调度，terminal 表示链上非 Pending 且与意图
 * 冲突，保留供人工处置；时间均为 ISO 字符串。该 schema 故意只含基础合约字段，不含
 * dimensionalScores，所以进程恢复后的重试使用 recordAuditResult 兼容调用。
 */
export interface ListenerRetryQueueItem {
  eventKey: string;
  state: "pending" | "terminal";
  tokenId: string;
  writeback: PersistedAuditWritebackSummary;
  attemptCount: number;
  lastAttemptAt: string;
  nextAttemptAt: string;
  lastError: string;
}

/**
 * 审计执行重试保存可重建 AuditRequestedEvent 的全部链上定位信息，但不复制报告产物。该队列
 * 没有 terminal 字段：项目存在即表示仍待执行，只有得到非可重试的结构化结果后才删除。
 * tokenId 字符串和 ISO 时间是跨进程持久化格式，eventKey 仍是唯一更新键。
 */
export interface ListenerAuditExecutionRetryItem {
  eventKey: string;
  tokenId: string;
  developer: string;
  agentName: string;
  manifestUrl: string;
  blockNumber: number;
  transactionHash: string;
  attemptCount: number;
  lastAttemptAt: string;
  nextAttemptAt: string;
  lastReasonCode: string;
  lastError: string;
}

/**
 * 斩罚重试绑定明确的 tokenId + auditId + amount + reasonCode，而不是“最新审计”，防止恢复后
 * 将资金动作错误应用到后续记录。链上整数以十进制字符串持久化保持 bigint 精度；默认调度只
 * 处理 pending。类型允许 terminal，但当前创建/flush 路径不会产生它；任何 terminal 项均由外部
 * 状态管理或迁移负责，并会被调度器跳过。
 */
export interface ListenerSlashRetryItem {
  eventKey: string;
  state: "pending" | "terminal";
  tokenId: string;
  auditId: number;
  slashAmount: string;
  reasonCode: SlashReasonCode;
  attemptCount: number;
  lastAttemptAt: string;
  nextAttemptAt: string;
  lastError: string;
}

/**
 * nextBlock 是尚未轮询区间的第一个区块（独占游标），不是最后成功区块。外层仅在整批处理成功
 * 后原子写入它；updatedAt 用于运维审计，不参与链上排序或最终性判断。
 */
export interface PersistedListenerCursor {
  nextBlock: number;
  updatedAt: string;
}

/**
 * 单个事件经过执行、证据构建和报告落盘后的聚合结果。reportPersistence 是返回前必须完成的
 * 本地持久化；evidence/attestation 和远端 reportStorage 可按配置缺席。对象本身仍是进程内状态，
 * 链上是否写入及失败后的队列归属由 listener 编排层决定。
 */
export interface ProcessedAuditRequested {
  event: AuditRequestedEvent;
  auditResult: LocalAuditResult;
  evidence?: {
    events: AuditEvidenceEvent[];
    eventCount: number;
    evidenceRoot: string;
    attestationHash: string;
    evidenceCID: string;
  };
  evidencePersistence?: PersistedAuditEvidenceArtifact;
  attestationPersistence?: PersistedAuditAttestationArtifact;
  reportArtifact: AuditReportArtifact;
  reportPersistence: PersistedAuditReportArtifact;
  writeback: AuditWritebackSummary;
  reportStorage?: ProcessedReportStorageSummary;
}

/**
 * 处理器通过依赖注入明确隔离清单获取、沙箱执行、证明生成及文件持久化等信任/I/O 边界。
 * 除上层有意转换的报告远端存储故障外，依赖抛错会终止当前事件并阻止游标推进；实现必须保留
 * event/token 关联，且不得把外部清单或沙箱输出未经验证地提升为可信配置。
 */
export interface ProcessAuditRequestedDependencies {
  loadManifestSource: (manifestLocation: string) => Promise<LoadedManifestSource>;
  createAuditAttestation?: (
    input: CreateAuditAttestationInput
  ) => Promise<CreateAuditAttestationResult>;
  persistAuditEvidence?: (
    options: PersistAuditEvidenceOptions
  ) => Promise<PersistedAuditEvidenceArtifact>;
  persistAuditAttestation?: (
    options: PersistAuditAttestationOptions
  ) => Promise<PersistedAuditAttestationArtifact>;
  persistAuditReport: (
    options: PersistAuditReportOptions
  ) => Promise<PersistedAuditReportArtifact>;
  buildAuditRequest: (
    event: AuditRequestedEvent,
    manifest: SandboxManifest
  ) => AuditSolveRequest | Promise<AuditSolveRequest>;
  runAudit: (options: RunAuditForEventOptions) => Promise<LocalAuditResult>;
}
