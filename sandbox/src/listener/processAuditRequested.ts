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
  storePersistedAuditReport?: (
    options: StorePersistedAuditReportOptions
  ) => Promise<StoredAuditReportIdentifiers>;
};

function buildManifestMismatchResult(
  event: AuditRequestedEvent,
  manifestHash: string
): LocalAuditResult {
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
  const scored = scoreAuditResult(result);

  // Compute dimensional scores if evaluations are available
  let dimensionalScores: DimensionalScoresWriteback | undefined;

  if (result.answerEvaluations && result.answerEvaluations.length > 0) {
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
  const reasonCode: RetryableAuditExecutionReasonCode = "REPORT_STORAGE_FAILED";

  return {
    ...result,
    status: "failed",
    reasonCode
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

export async function processAuditRequested(
  event: AuditRequestedEvent,
  dependencies: ProcessAuditRequestedDependencies
): Promise<ProcessedAuditRequested> {
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
    loaded.manifest.agent_name === event.agentName
      ? await dependencies.runAudit({
          manifestLocation: event.manifestUrl,
          request: await dependencies.buildAuditRequest(event, loaded.manifest),
          emitEvidence: async (evidence) => {
            appendAuditEvidenceEvent(evidenceContext, evidence);
          }
        })
      : buildManifestMismatchResult(event, loaded.manifestHash);
  const provisionalReport = buildAuditReport(auditResult);
  appendAuditEvidenceEvent(evidenceContext, {
    stage: "report_built",
    payload: {
      reportBodyHash: provisionalReport.reportHash
    }
  });
  const evidenceRoot = evidenceContext.evidenceRoot;
  const attestationResult: CreateAuditAttestationResult | undefined = dependencies.createAuditAttestation
    ? await dependencies.createAuditAttestation({
        event,
        manifestHash: auditResult.manifestHash,
        evidenceRoot
      })
    : undefined;
  const attestationHash = attestationResult?.attestationHash ?? ZERO_EVIDENCE_HASH;
  const evidenceCID = "";
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
  const reportArtifact = buildAuditReport(auditResult, {
    evidence: {
      evidenceRoot,
      eventCount: evidenceContext.events.length,
      attestationHash,
      evidenceCid: evidenceCID
    }
  });
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
