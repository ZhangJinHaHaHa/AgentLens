/**
 * CDK 的只读链适配层：编码注册表查询、通过 JSON-RPC 执行 eth_call，并把 ABI 返回值规范化为不会丢失精度的领域对象；不签名、不发送交易。
 * rpcUrl、合约地址、tokenId 和可注入 fetch 是输入，AgentProfile/AuditReport/费用/信誉是输出；RPC 响应与合约字节均属于不可信网络边界。
 * HTTP 非成功、JSON-RPC error、缺少 result、ABI 不匹配及整数越界均应抛错，不得伪造默认链状态；仅 bytes32 零值和空 CID按协议转换为“字段缺席”。
 * 每次读取针对 latest 独立执行，跨调用不承诺同一区块快照或事务一致性；V2/V3 Interface 的选择及字段单位是与已部署合约的兼容不变量。
 */
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
