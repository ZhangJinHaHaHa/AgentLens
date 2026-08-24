import { scoreAuditResult } from "../audit/scoreAuditResult";
import { computeDimensionalScores } from "../audit/dimensionalScoring";
import type { CreateAuditAttestationResult } from "../attestation/buildAuditAttestation";
import { appendAuditEvidenceEvent, createAuditEvidenceChainContext } from "../evidence/evidenceChain";
import { ZERO_EVIDENCE_HASH } from "../evidence/buildAuditEvidenceEvent";
import { buildAuditReport } from "../report/buildAuditReport";
import type { StorePersistedAuditReportOptions } from "../report/storePersistedAuditReport";
import type { LocalAuditResult } from "../types/manifest";
import type {
  AuditRequestedEvent,
  AuditWritebackSummary,
  DimensionalScoresWriteback,
  ProcessedAuditRequested,
  ProcessedReportStorageSummary
} from "./types";
import type { StoredAuditReportIdentifiers } from "./types";
import type { ProcessAuditRequestedDependencies as BaseProcessAuditRequestedDependencies } from "./types";
import { type RetryableAuditExecutionReasonCode } from "./retryAuditExecutionQueue";

type ProcessAuditRequestedDependencies = BaseProcessAuditRequestedDependencies & {
  // 远端存储是本地报告落盘后的可选阶段；返回的内容地址随后进入链上写回摘要。
  storePersistedAuditReport?: (
    options: StorePersistedAuditReportOptions
  ) => Promise<StoredAuditReportIdentifiers>;
};

function buildManifestMismatchResult(
  event: AuditRequestedEvent,
  manifestHash: string
): LocalAuditResult {
  // 不匹配在进入容器前转换为完整失败结果；两个时间戳相同表示没有实际沙箱执行窗口。
  const finishedAt = new Date().toISOString();

  return {
    agentName: event.agentName,
    manifestHash,
    healthcheckPassed: false,
    answer: "",
    actions: [],
    decisionType: "undetermined",
    cpuAvgMilli: 0,
    memoryPeakMb: 0,
    requestedIps: [],
    requestedHosts: [],
    requestCount: 0,
    status: "failed",
    reasonCode: "MANIFEST_NAME_MISMATCH",
    startedAt: finishedAt,
    finishedAt
  };
}

function buildWritebackSummary(
  event: AuditRequestedEvent,
  result: LocalAuditResult,
  reportHash: string,
  evidenceRoot: string,
  attestationHash: string,
  evidenceCID: string,
  reportCID: string
): AuditWritebackSummary {
  // 链上状态只消费规范化后的 Passed/Failed 与 0/100 分数，不直接信任运行器的自由形式状态字段。
  const scored = scoreAuditResult(result);

  // Compute dimensional scores if evaluations are available
  let dimensionalScores: DimensionalScoresWriteback | undefined;

  if (result.answerEvaluations && result.answerEvaluations.length > 0) {
    // 合约 V2 约定维度分数为百分制整数域；这里的乘数及字段顺序必须与 ABI 元组保持兼容。
    const dimScores = computeDimensionalScores(result);
    dimensionalScores = {
      security: dimScores.dimensions.security * 100,
      taskExecution: dimScores.dimensions.task_execution * 100,
      cognitive: dimScores.dimensions.cognitive * 100,
      environment: dimScores.dimensions.environment * 100,
      engineering: dimScores.dimensions.engineering * 100,
      compliance: dimScores.dimensions.compliance * 100
    };
  }

  return {
    tokenId: event.tokenId,
    auditScore: scored.auditScore,
    memoryPeakMb: result.memoryPeakMb,
    cpuAvgMilli: result.cpuAvgMilli,
    requestIpCount: result.requestCount,
    status: scored.status,
    manifestHash: result.manifestHash,
    reportHash,
    evidenceRoot,
    attestationHash,
    evidenceCID,
    reportCID,
    manifestUrl: event.manifestUrl,
    ...(dimensionalScores ? { dimensionalScores } : {})
  };
}

function buildReportStorageFailureResult(result: LocalAuditResult): LocalAuditResult {
  // 远端报告不可寻址会阻止生成可验证写回，因此提升为专用、可重试的基础设施失败码。
  const reasonCode: RetryableAuditExecutionReasonCode = "REPORT_STORAGE_FAILED";

  return {
    ...result,
    status: "failed",
    reasonCode
  };
}

function toErrorMessage(error: unknown): string {
  // 只保存可诊断文本，不把未知错误对象序列化进状态或日志，避免意外携带凭据等附加字段。
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

export async function processAuditRequested(
  event: AuditRequestedEvent,
  dependencies: ProcessAuditRequestedDependencies
): Promise<ProcessedAuditRequested> {
  /**
   * 本函数拥有单次事件从取清单、执行审计到形成可写回产物的顺序，但不拥有去重或退避。
   * 同一 eventKey 再次调用会重新获取清单、运行沙箱并触发持久化/远端 I/O；正常监听由内存 claim
   * 限制同进程重复，失败恢复由外层持久化队列及链上对账实现。
   */
  const evidenceContext = createAuditEvidenceChainContext({
    eventKey: event.eventKey,
    tokenId: event.tokenId
  });
  appendAuditEvidenceEvent(evidenceContext, {
    stage: "audit_requested_observed",
    payload: {
      developer: event.developer,
      agentName: event.agentName,
      manifestUrl: event.manifestUrl,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    }
  });
  // manifestUrl 来自链上事件但指向外部内容；加载器负责 URL/文件边界、内容校验和哈希，失败直接中止本次处理。
  const loaded = await dependencies.loadManifestSource(event.manifestUrl);
  appendAuditEvidenceEvent(evidenceContext, {
    stage: "manifest_fetched",
    payload: {
      manifestUrl: event.manifestUrl,
      manifestHash: loaded.manifestHash
    }
  });
  appendAuditEvidenceEvent(evidenceContext, {
    stage: "manifest_validated",
    payload: {
      manifestAgentName: loaded.manifest.agent_name,
      requestedAgentName: event.agentName,
      image: loaded.manifest.image
    }
  });

  const auditResult =
    // 链上声明的代理名必须与已哈希清单一致；不匹配时绝不构造请求或启动不受信容器。
    loaded.manifest.agent_name === event.agentName
      ? await dependencies.runAudit({
          manifestLocation: event.manifestUrl,
          request: await dependencies.buildAuditRequest(event, loaded.manifest),
          emitEvidence: async (evidence) => {
            appendAuditEvidenceEvent(evidenceContext, evidence);
          }
        })
      : buildManifestMismatchResult(event, loaded.manifestHash);
  // 先哈希不含 evidence 元数据的报告主体并写入证据链，避免“报告哈希包含证据根、证据根又包含报告哈希”的自引用。
  const provisionalReport = buildAuditReport(auditResult);
  appendAuditEvidenceEvent(evidenceContext, {
    stage: "report_built",
    payload: {
      reportBodyHash: provisionalReport.reportHash
    }
  });
  // evidenceRoot 在完成 report_built 事件后冻结；如启用证明提供方，其签署输入就是这条有序证据链的最终根。
  const evidenceRoot = evidenceContext.evidenceRoot;
  const attestationResult: CreateAuditAttestationResult | undefined = dependencies.createAuditAttestation
    ? await dependencies.createAuditAttestation({
        event,
        manifestHash: auditResult.manifestHash,
        evidenceRoot
      })
    : undefined;
  // 未启用证明时使用稳定的零哈希哨兵，保持旧合约 bytes32 写回布局，不把“缺失”编码成不同 calldata 形状。
  const attestationHash = attestationResult?.attestationHash ?? ZERO_EVIDENCE_HASH;
  // evidenceCID 目前保留为空字符串以维持 V1 写回兼容；本地 evidencePersistence 路径不冒充内容地址。
  const evidenceCID = "";
  // 证据和证明持久化是可选能力，启用后其 I/O 错误向上传播；各文件独立发布，不提供跨产物事务。
  const evidencePersistence = dependencies.persistAuditEvidence
    ? await dependencies.persistAuditEvidence({
        eventKey: event.eventKey,
        tokenId: event.tokenId,
        chain: evidenceContext
      })
    : undefined;
  const attestationPersistence =
    attestationResult && dependencies.persistAuditAttestation
      ? await dependencies.persistAuditAttestation({
          eventKey: event.eventKey,
          tokenId: event.tokenId,
          attestationArtifact: attestationResult
        })
      : undefined;
  // 最终报告纳入冻结的证据根和证明哈希；因此它的 reportHash 与上面的 provisionalReport.reportHash 按设计不同。
  const reportArtifact = buildAuditReport(auditResult, {
    evidence: {
      evidenceRoot,
      eventCount: evidenceContext.events.length,
      attestationHash,
      evidenceCid: evidenceCID
    }
  });
  // 本地报告是后续远端上传与重试的持久锚点，属于必选阶段；失败不能降级为一条缺少报告的链上结果。
  const reportPersistence = await dependencies.persistAuditReport({
    event,
    reportArtifact
  });
  let reportCID = "";
  let finalResult = auditResult;
  let reportStorage: ProcessedReportStorageSummary = {
    outcome: "skipped"
  };

  if (dependencies.storePersistedAuditReport) {
    try {
      // 先完成 COS/IPFS 适配器的远端存储，只有成功返回的 CID 才进入写回，避免发布不可取回的引用。
      const stored = await dependencies.storePersistedAuditReport({
        event,
        reportArtifact,
        reportPersistence
      });
      reportCID = stored.reportCid;
      reportStorage = {
        outcome: "stored",
        cosObjectKey: stored.cosObjectKey
      };
    } catch (error) {
      // 仅远端存储失败在此收敛为可重试结果；清单、沙箱、本地持久化及证明失败仍保持异常语义。
      finalResult = buildReportStorageFailureResult(auditResult);
      reportCID = "";
      reportStorage = {
        outcome: "failed",
        error: toErrorMessage(error),
        originalAuditStatus: auditResult.status,
        originalAuditReasonCode: auditResult.reasonCode ?? null
      };
    }
  }

  // reportArtifact 记录原始审计事实；若远端存储失败，finalResult/writeback 标记基础设施失败并另存原始状态用于诊断。
  return {
    event,
    auditResult: finalResult,
    evidence: {
      events: evidenceContext.events,
      eventCount: evidenceContext.events.length,
      evidenceRoot,
      attestationHash,
      evidenceCID
    },
    evidencePersistence,
    attestationPersistence,
    reportArtifact,
    reportPersistence,
    writeback: buildWritebackSummary(
      event,
      finalResult,
      reportArtifact.reportHash,
      evidenceRoot,
      attestationHash,
      evidenceCID,
      reportCID
    ),
    reportStorage
  };
}
