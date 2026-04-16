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

export interface ListenerWritebackEnabledConfig {
  enabled: true;
  operatorPrivateKey: string;
  chainId: number;
}

export type ListenerWritebackConfig =
  | ListenerWritebackDisabledConfig
  | ListenerWritebackEnabledConfig;

export interface RunAuditForEventOptions {
  manifestLocation: string;
  request: AuditSolveRequest;
  emitEvidence?: (event: { stage: AuditEvidenceStage; payload: unknown; timestamp?: string }) => Promise<void>;
}

export interface DimensionalScoresWriteback {
  security: number;
  taskExecution: number;
  cognitive: number;
  environment: number;
  engineering: number;
  compliance: number;
}

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
  reportCid: string;
  cosObjectKey: string;
}

export type SlashReasonCode = "UNDECLARED_EGRESS" | "ACTION_MISMATCH";

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

export interface PersistedListenerCursor {
  nextBlock: number;
  updatedAt: string;
}

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
