import { Contract, JsonRpcProvider, type InterfaceAbi } from "ethers";

import artifact from "../../../contracts/artifacts/AgentAuditRegistry.json";
import v2Artifact from "../../../contracts/artifacts/AgentAuditRegistryV2.json";
import v3Artifact from "../../../contracts/artifacts/AgentAuditRegistryV3.json";
import type { AppConfig } from "../config/appConfig";

export type NumericValue = bigint | number;

export interface AgentProfile {
  developer: string;
  agentName: string;
  tokenId: NumericValue;
  totalBond: NumericValue;
  blacklisted: boolean;
  createdAt: NumericValue;
  lastAuditAt: NumericValue;
  auditCount: NumericValue;
}

export interface AuditRecord {
  auditId: NumericValue;
  timestamp: NumericValue;
  auditScore: NumericValue;
  memoryPeakMb: NumericValue;
  cpuAvgMilli: NumericValue;
  requestIpCount: NumericValue;
  status: NumericValue;
  manifestHash: string;
  reportHash: string;
  reportCID: string;
  manifestUrl: string;
  // Keccak256 digest of the canonical attestation bundle the listener received
  // from the SGX Attestation API. bytes32(0) means the audit was recorded
  // without a TEE attestation (legacy / mock path).
  attestationHash?: string;
  appealRequested: boolean;
  appealApproved: boolean;
}

export interface AgentAuditRegistryReadContract {
  getAgentProfile(tokenId: bigint): Promise<AgentProfile>;
  getLatestAuditReport(tokenId: bigint): Promise<AuditRecord>;
  getAuditCount(tokenId: bigint): Promise<bigint>;
  getAuditReportByIndex(tokenId: bigint, index: number): Promise<AuditRecord>;
}

interface CreateAgentAuditRegistryClientOptions {
  contract?: AgentAuditRegistryReadContract;
}

export interface DimensionalScoresOnChain {
  security: number;
  taskExecution: number;
  cognitive: number;
  environment: number;
  engineering: number;
  compliance: number;
}

export interface ReputationRecordOnChain {
  successfulAppeals: number;
  failedAppeals: number;
  reputationDelta: number;
  currentReputationScore: number;
  lastReputationUpdateAt: number;
}

export interface AppealRecordOnChain {
  appealId: number;
  auditId: number;
  filedAt: number;
  resolvedAt: number;
  outcome: number; // 0=Pending, 1=Approved, 2=Rejected
  evidenceHash: string;
  appealCID: string;
}

export interface AgentAuditRegistryClient {
  getAgentProfile(tokenId: bigint): Promise<AgentProfile>;
  getLatestAuditReport(tokenId: bigint): Promise<AuditRecord>;
  getAuditCount(tokenId: bigint): Promise<bigint>;
  getAuditReportByIndex(tokenId: bigint, index: number): Promise<AuditRecord>;
}

export interface AgentAuditRegistryV2Client extends AgentAuditRegistryClient {
  getReputation(tokenId: bigint): Promise<ReputationRecordOnChain>;
  getAppealCount(tokenId: bigint): Promise<bigint>;
  getAppealRecord(tokenId: bigint, appealId: number): Promise<AppealRecordOnChain>;
  getAverageScores(tokenId: bigint): Promise<DimensionalScoresOnChain>;
  getDimensionalScores(tokenId: bigint, auditIndex: number): Promise<DimensionalScoresOnChain>;
}

export function createAgentAuditRegistryClient(
  config: AppConfig,
  options: CreateAgentAuditRegistryClientOptions = {}
): AgentAuditRegistryClient {
  const contract =
    options.contract ??
    new Contract(
      config.registryAddress,
      artifact.abi as InterfaceAbi,
      new JsonRpcProvider(config.rpcUrl, config.chainId)
    );

  return {
    getAgentProfile(tokenId) {
      return contract.getAgentProfile(tokenId);
    },
    getLatestAuditReport(tokenId) {
      return contract.getLatestAuditReport(tokenId);
    },
    getAuditCount(tokenId) {
      return contract.getAuditCount(tokenId);
    },
    getAuditReportByIndex(tokenId, index) {
      return contract.getAuditReportByIndex(tokenId, index);
    }
  };
}

const OUTCOME_LABELS: Record<number, "Pending" | "Approved" | "Rejected"> = {
  0: "Pending",
  1: "Approved",
  2: "Rejected"
};

export function createAgentAuditRegistryV2Client(
  contractAddress: string,
  rpcUrl: string,
  chainId: number
): AgentAuditRegistryV2Client {
  const provider = new JsonRpcProvider(rpcUrl, chainId);
  const contract = new Contract(contractAddress, v3Artifact.abi as InterfaceAbi, provider);

  return {
    getAgentProfile(tokenId) {
      return contract.getAgentProfile(tokenId);
    },
    getLatestAuditReport(tokenId) {
      return contract.getLatestAuditReport(tokenId);
    },
    getAuditCount(tokenId) {
      return contract.getAuditCount(tokenId);
    },
    getAuditReportByIndex(tokenId, index) {
      return contract.getAuditReportByIndex(tokenId, index);
    },
    async getReputation(tokenId) {
      const rep = await contract.getReputation(tokenId);
      return {
        successfulAppeals: Number(rep.successfulAppeals),
        failedAppeals: Number(rep.failedAppeals),
        reputationDelta: Number(rep.reputationDelta),
        currentReputationScore: Number(rep.currentReputationScore),
        lastReputationUpdateAt: Number(rep.lastReputationUpdateAt)
      };
    },
    getAppealCount(tokenId) {
      return contract.getAppealCount(tokenId);
    },
    async getAppealRecord(tokenId, appealId) {
      const rec = await contract.getAppealRecord(tokenId, appealId);
      return {
        appealId: Number(rec.appealId),
        auditId: Number(rec.auditId),
        filedAt: Number(rec.filedAt),
        resolvedAt: Number(rec.resolvedAt),
        outcome: Number(rec.outcome),
        evidenceHash: String(rec.evidenceHash),
        appealCID: String(rec.appealCID)
      };
    },
    async getAverageScores(tokenId) {
      const scores = await contract.getAverageScores(tokenId);
      return {
        security: Number(scores.security),
        taskExecution: Number(scores.taskExecution),
        cognitive: Number(scores.cognitive),
        environment: Number(scores.environment),
        engineering: Number(scores.engineering),
        compliance: Number(scores.compliance)
      };
    },
    async getDimensionalScores(tokenId, auditIndex) {
      const scores = await contract.getDimensionalScores(tokenId, auditIndex);
      return {
        security: Number(scores.security),
        taskExecution: Number(scores.taskExecution),
        cognitive: Number(scores.cognitive),
        environment: Number(scores.environment),
        engineering: Number(scores.engineering),
        compliance: Number(scores.compliance)
      };
    }
  };
}

export function parseAppealOutcome(outcome: number): "Pending" | "Approved" | "Rejected" {
  return OUTCOME_LABELS[outcome] ?? "Pending";
}
