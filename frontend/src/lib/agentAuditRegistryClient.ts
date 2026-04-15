import { Contract, JsonRpcProvider, type InterfaceAbi } from "ethers";

import artifact from "../../../contracts/artifacts/AgentAuditRegistry.json";
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

export interface AgentAuditRegistryClient {
  getAgentProfile(tokenId: bigint): Promise<AgentProfile>;
  getLatestAuditReport(tokenId: bigint): Promise<AuditRecord>;
  getAuditCount(tokenId: bigint): Promise<bigint>;
  getAuditReportByIndex(tokenId: bigint, index: number): Promise<AuditRecord>;
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
