/**
 * AgentAuditRegistry 的只读适配层：用部署配置/ABI 构造 v1、v2、v3 客户端，并把合约元组转换为前端使用的档案、审计、信誉、申诉和六维分数。
 * 工厂输入包括合约地址、RPC、chainId 与 token/index；返回的方法均可能发起 JSON-RPC，基础版本允许注入只读 contract 作为测试边界。
 * 客户端不保存业务状态、不缓存响应、不设置超时或重试，provider/合约构造及调用错误会原样拒绝，调用方负责取消陈旧展示和恢复策略。
 * RPC 节点、地址、ABI 与返回元组均跨越外部信任边界，TypeScript 断言不做运行时验真；用于授权或结算时必须由服务端连接权威网络复核。
 * 多处 bigint 转 number 依赖合约字段处于设计量纲内，超大值可能失真；扩展合约升级必须保持字段顺序和数值范围兼容。
 * V3 当前复用 V2 读取接口，未知申诉 outcome 为兼容旧/新枚举回退 Pending，而不是擅自判为通过或拒绝。
 */
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

export type AgentAuditRegistryV3Client = AgentAuditRegistryV2Client;

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
  return createExtendedAgentAuditRegistryClient(contractAddress, rpcUrl, chainId, v2Artifact.abi as InterfaceAbi);
}

export function createAgentAuditRegistryV3Client(
  contractAddress: string,
  rpcUrl: string,
  chainId: number
): AgentAuditRegistryV3Client {
  return createExtendedAgentAuditRegistryClient(contractAddress, rpcUrl, chainId, v3Artifact.abi as InterfaceAbi);
}

function createExtendedAgentAuditRegistryClient(
  contractAddress: string,
  rpcUrl: string,
  chainId: number,
  abi: InterfaceAbi
): AgentAuditRegistryV2Client {
  const provider = new JsonRpcProvider(rpcUrl, chainId);
  const contract = new Contract(contractAddress, abi, provider);

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
        currentReputationScore: Number(rep.currentReputationScore ?? 0),
        lastReputationUpdateAt: Number(rep.lastReputationUpdateAt ?? 0)
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
