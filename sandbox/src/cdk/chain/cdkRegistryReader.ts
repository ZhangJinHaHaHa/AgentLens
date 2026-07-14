import { decodedIntegerToBigInt, decodedIntegerToNumber } from "../../chain/decodedInteger";
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
  tokenId: unknown;
  totalBond: unknown;
  blacklisted: boolean;
  createdAt: unknown;
  lastAuditAt: unknown;
  auditCount: unknown;
};

type DecodedDimensionalScores = {
  security: unknown;
  taskExecution: unknown;
  cognitive: unknown;
  environment: unknown;
  engineering: unknown;
  compliance: unknown;
};

type DecodedAuditReport = {
  auditId: unknown;
  timestamp: unknown;
  auditScore: unknown;
  memoryPeakMb: unknown;
  cpuAvgMilli: unknown;
  requestIpCount: unknown;
  status: unknown;
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
    tokenId: decodedIntegerToBigInt(decoded.tokenId, "tokenId"),
    totalBond: decodedIntegerToBigInt(decoded.totalBond, "totalBond"),
    blacklisted: decoded.blacklisted,
    createdAt: decodedIntegerToNumber(decoded.createdAt, "createdAt"),
    lastAuditAt: decodedIntegerToNumber(decoded.lastAuditAt, "lastAuditAt"),
    auditCount: decodedIntegerToNumber(decoded.auditCount, "auditCount")
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
    security: decodedIntegerToNumber(decoded.dimensionalScores.security, "security"),
    taskExecution: decodedIntegerToNumber(decoded.dimensionalScores.taskExecution, "taskExecution"),
    cognitive: decodedIntegerToNumber(decoded.dimensionalScores.cognitive, "cognitive"),
    environment: decodedIntegerToNumber(decoded.dimensionalScores.environment, "environment"),
    engineering: decodedIntegerToNumber(decoded.dimensionalScores.engineering, "engineering"),
    compliance: decodedIntegerToNumber(decoded.dimensionalScores.compliance, "compliance")
  };

  return {
    auditId: decodedIntegerToNumber(decoded.auditId, "auditId"),
    timestamp: decodedIntegerToNumber(decoded.timestamp, "timestamp"),
    auditScore: decodedIntegerToNumber(decoded.auditScore, "auditScore"),
    memoryPeakMb: decodedIntegerToNumber(decoded.memoryPeakMb, "memoryPeakMb"),
    cpuAvgMilli: decodedIntegerToNumber(decoded.cpuAvgMilli, "cpuAvgMilli"),
    requestIpCount: decodedIntegerToNumber(decoded.requestIpCount, "requestIpCount"),
    status: decodedIntegerToNumber(decoded.status, "status"),
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

  const decoded = iface.decodeFunctionResult("serviceFee", result)[0];
  return decodedIntegerToBigInt(decoded, "serviceFee");
}

type DecodedReputationRecord = {
  successfulAppeals: unknown;
  failedAppeals: unknown;
  reputationDelta: unknown;
  currentReputationScore: unknown;
  lastReputationUpdateAt: unknown;
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
    successfulAppeals: decodedIntegerToNumber(decoded.successfulAppeals, "successfulAppeals"),
    failedAppeals: decodedIntegerToNumber(decoded.failedAppeals, "failedAppeals"),
    reputationDelta: decodedIntegerToNumber(decoded.reputationDelta, "reputationDelta"),
    currentReputationScore: decodedIntegerToNumber(decoded.currentReputationScore, "currentReputationScore"),
    lastReputationUpdateAt: decodedIntegerToNumber(decoded.lastReputationUpdateAt, "lastReputationUpdateAt")
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

  const decoded = iface.decodeFunctionResult("minimumBond", result)[0];
  return decodedIntegerToBigInt(decoded, "minimumBond");
}
