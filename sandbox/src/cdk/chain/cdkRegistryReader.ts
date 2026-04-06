import { BigNumber } from "ethers";

import { getCdkV2Interface, getCdkV3Interface } from "./cdkArtifact";
import type { AgentProfile, AuditReport, DimensionalScores, ReputationInfo } from "../cdkTypes";

interface JsonRpcSuccessResult<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

interface JsonRpcErrorResult {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
  };
}

async function jsonRpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  fetchImpl: typeof fetch
): Promise<T> {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });

  if (!response.ok) {
    throw new Error(`JSON-RPC request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as JsonRpcSuccessResult<T> | JsonRpcErrorResult;
  if ("error" in payload) {
    throw new Error(`${method} returned JSON-RPC error ${payload.error.code}: ${payload.error.message}`);
  }
  if (!("result" in payload)) {
    throw new Error(`${method} response missing result`);
  }

  return payload.result;
}

export interface ReadRegistryOptions {
  rpcUrl: string;
  contractAddress: string;
  fetchImpl?: typeof fetch;
}

type DecodedProfile = {
  developer: string;
  agentName: string;
  tokenId: BigNumber;
  totalBond: BigNumber;
  blacklisted: boolean;
  createdAt: BigNumber;
  lastAuditAt: BigNumber;
  auditCount: number;
};

type DecodedDimensionalScores = {
  security: number;
  taskExecution: number;
  cognitive: number;
  environment: number;
  engineering: number;
  compliance: number;
};

type DecodedAuditReport = {
  auditId: BigNumber;
  timestamp: BigNumber;
  auditScore: number;
  memoryPeakMb: number;
  cpuAvgMilli: number;
  requestIpCount: number;
  status: number;
  manifestHash: `0x${string}`;
  reportHash: `0x${string}`;
  evidenceRoot: `0x${string}`;
  attestationHash: `0x${string}`;
  evidenceCID: string;
  reportCID: string;
  manifestUrl: string;
  appealRequested: boolean;
  appealApproved: boolean;
  dimensionalScores: DecodedDimensionalScores;
};

export async function readAgentProfile(
  options: ReadRegistryOptions,
  tokenId: bigint
): Promise<AgentProfile> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const iface = getCdkV2Interface();

  const callData = iface.encodeFunctionData("getAgentProfile", [tokenId]) as `0x${string}`;
  const result = await jsonRpcCall<`0x${string}`>(
    options.rpcUrl,
    "eth_call",
    [{ to: options.contractAddress, data: callData }, "latest"],
    fetchImpl
  );

  const decoded = iface.decodeFunctionResult("getAgentProfile", result)[0] as DecodedProfile;

  return {
    developer: decoded.developer,
    agentName: decoded.agentName,
    tokenId: decoded.tokenId.toBigInt(),
    totalBond: decoded.totalBond.toBigInt(),
    blacklisted: decoded.blacklisted,
    createdAt: decoded.createdAt.toNumber(),
    lastAuditAt: decoded.lastAuditAt.toNumber(),
    auditCount: decoded.auditCount
  };
}

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

export async function readLatestAuditReport(
  options: ReadRegistryOptions,
  tokenId: bigint
): Promise<AuditReport> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const iface = getCdkV2Interface();

  const callData = iface.encodeFunctionData("getLatestAuditReport", [tokenId]) as `0x${string}`;
  const result = await jsonRpcCall<`0x${string}`>(
    options.rpcUrl,
    "eth_call",
    [{ to: options.contractAddress, data: callData }, "latest"],
    fetchImpl
  );

  const decoded = iface.decodeFunctionResult("getLatestAuditReport", result)[0] as DecodedAuditReport;

  const dimensionalScores: DimensionalScores = {
    security: decoded.dimensionalScores.security,
    taskExecution: decoded.dimensionalScores.taskExecution,
    cognitive: decoded.dimensionalScores.cognitive,
    environment: decoded.dimensionalScores.environment,
    engineering: decoded.dimensionalScores.engineering,
    compliance: decoded.dimensionalScores.compliance
  };

  return {
    auditId: decoded.auditId.toNumber(),
    timestamp: decoded.timestamp.toNumber(),
    auditScore: decoded.auditScore,
    memoryPeakMb: decoded.memoryPeakMb,
    cpuAvgMilli: decoded.cpuAvgMilli,
    requestIpCount: decoded.requestIpCount,
    status: decoded.status,
    manifestHash: decoded.manifestHash,
    reportHash: decoded.reportHash,
    ...(decoded.evidenceRoot !== ZERO_BYTES32 ? { evidenceRoot: decoded.evidenceRoot } : {}),
    ...(decoded.attestationHash !== ZERO_BYTES32 ? { attestationHash: decoded.attestationHash } : {}),
    ...(decoded.evidenceCID ? { evidenceCID: decoded.evidenceCID } : {}),
    reportCID: decoded.reportCID,
    manifestUrl: decoded.manifestUrl,
    appealRequested: decoded.appealRequested,
    appealApproved: decoded.appealApproved,
    dimensionalScores
  };
}

export async function readServiceFee(options: ReadRegistryOptions): Promise<bigint> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const iface = getCdkV2Interface();

  const callData = iface.encodeFunctionData("serviceFee") as `0x${string}`;
  const result = await jsonRpcCall<`0x${string}`>(
    options.rpcUrl,
    "eth_call",
    [{ to: options.contractAddress, data: callData }, "latest"],
    fetchImpl
  );

  const decoded = iface.decodeFunctionResult("serviceFee", result)[0] as BigNumber;
  return decoded.toBigInt();
}

type DecodedReputationRecord = {
  successfulAppeals: number;
  failedAppeals: number;
  reputationDelta: number;
  currentReputationScore: number;
  lastReputationUpdateAt: BigNumber;
};

export async function readReputation(
  options: ReadRegistryOptions,
  tokenId: bigint
): Promise<ReputationInfo> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const iface = getCdkV3Interface();

  const callData = iface.encodeFunctionData("getReputation", [tokenId]) as `0x${string}`;
  const result = await jsonRpcCall<`0x${string}`>(
    options.rpcUrl,
    "eth_call",
    [{ to: options.contractAddress, data: callData }, "latest"],
    fetchImpl
  );

  const decoded = iface.decodeFunctionResult("getReputation", result)[0] as DecodedReputationRecord;

  return {
    successfulAppeals: decoded.successfulAppeals,
    failedAppeals: decoded.failedAppeals,
    reputationDelta: decoded.reputationDelta,
    currentReputationScore: decoded.currentReputationScore,
    lastReputationUpdateAt: decoded.lastReputationUpdateAt.toNumber()
  };
}

export async function readMinimumBond(options: ReadRegistryOptions): Promise<bigint> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const iface = getCdkV2Interface();

  const callData = iface.encodeFunctionData("minimumBond") as `0x${string}`;
  const result = await jsonRpcCall<`0x${string}`>(
    options.rpcUrl,
    "eth_call",
    [{ to: options.contractAddress, data: callData }, "latest"],
    fetchImpl
  );

  const decoded = iface.decodeFunctionResult("minimumBond", result)[0] as BigNumber;
  return decoded.toBigInt();
}
