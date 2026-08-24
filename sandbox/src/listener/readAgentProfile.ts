import { decodedIntegerToBigInt, decodedIntegerToNumber } from "../chain/decodedInteger";
import { getAuditRegistryInterface } from "./auditRegistryArtifact";

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

export interface AgentProfileOnChain {
  developer: string;
  agentName: string;
  tokenId: bigint;
  totalBond: bigint;
  blacklisted: boolean;
  createdAt: number;
  lastAuditAt: number;
  auditCount: number;
}

export interface ReadAgentProfileOptions {
  rpcUrl: string;
  contractAddress: string;
  tokenId: bigint;
  fetchImpl?: typeof fetch;
}

type DecodedAgentProfile = {
  developer: string;
  agentName: string;
  tokenId: unknown;
  totalBond: unknown;
  blacklisted: boolean;
  createdAt: unknown;
  lastAuditAt: unknown;
  auditCount: unknown;
};

/**
 * JSON-RPC 节点是外部信任边界：HTTP 非成功、协议级 error 与缺失 result 分别失败，
 * 并保留 method/状态码供上层观测。这里不拥有重试、超时或节点切换策略；监听循环决定失败是否重试，
 * 注入 fetchImpl 仅用于传输替换和确定性测试。
 */
async function jsonRpcRequest<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  fetchImpl: typeof fetch
): Promise<T> {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    })
  });

  if (!response.ok) {
    throw new Error(`JSON-RPC request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as JsonRpcSuccessResult<T> | JsonRpcErrorResult;
  // TypeScript 泛型不验证远端 JSON；显式判别 error/result 是进入 ABI 解码前的最小协议门禁。
  if ("error" in payload) {
    throw new Error(`${method} returned JSON-RPC error ${payload.error.code}: ${payload.error.message}`);
  }

  if (!("result" in payload)) {
    throw new Error(`${method} response missing result`);
  }

  return payload.result;
}

export async function readAgentProfile(
  options: ReadAgentProfileOptions
): Promise<AgentProfileOnChain> {
  const fetchImpl = options.fetchImpl ?? fetch;
  // calldata 始终由随发布物固定的 Registry ABI 编码，避免手写选择器或字段顺序与合约版本漂移。
  const callData = getAuditRegistryInterface().encodeFunctionData("getAgentProfile", [
    options.tokenId
  ]) as `0x${string}`;
  const result = await jsonRpcRequest<`0x${string}`>(
    options.rpcUrl,
    "eth_call",
    [
      {
        to: options.contractAddress,
        data: callData
      },
      // latest 返回的是节点当前视图而非最终确认快照；涉及罚没的调用方必须承担区块推进与竞态语义。
      "latest"
    ],
    fetchImpl
  );
  const decoded = getAuditRegistryInterface().decodeFunctionResult(
    "getAgentProfile",
    result
  )[0] as DecodedAgentProfile;

  // ABI 解码结果仍跨越库版本边界：金额保留 bigint，时间与计数仅在安全整数范围内转换，越界直接失败。
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
