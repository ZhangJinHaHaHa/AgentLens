import { decodedIntegerToNumber } from "../chain/decodedInteger";
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

/**
 * 这是合约 `AuditRecord` 在 listener 侧的稳定投影。链上注册表拥有记录状态；本类型只承载
 * 一次 `eth_call` 的解码结果，不代表本地缓存或最终性证明。可选证据字段保留了旧记录/旧消费方
 * 不提供扩展证据时的兼容形态，调用方不得因字段存在就推断证据已经过独立验证。
 */
export interface AuditReportByIndex {
  auditId: number;
  timestamp: number;
  auditScore: number;
  memoryPeakMb: number;
  cpuAvgMilli: number;
  requestIpCount: number;
  status: number;
  manifestHash: `0x${string}`;
  reportHash: `0x${string}`;
  evidenceRoot?: `0x${string}`;
  attestationHash?: `0x${string}`;
  evidenceCID?: string;
  reportCID: string;
  manifestUrl: string;
  appealRequested: boolean;
  appealApproved: boolean;
}

export interface ReadAuditReportByIndexOptions {
  rpcUrl: string;
  contractAddress: string;
  tokenId: bigint;
  index: number;
  fetchImpl?: typeof fetch;
}

type DecodedAuditRecord = {
  auditId: unknown;
  timestamp: unknown;
  auditScore: unknown;
  memoryPeakMb: unknown;
  cpuAvgMilli: unknown;
  requestIpCount: unknown;
  status: unknown;
  manifestHash: `0x${string}`;
  reportHash: `0x${string}`;
  evidenceRoot?: `0x${string}`;
  attestationHash?: `0x${string}`;
  evidenceCID?: string;
  reportCID: string;
  manifestUrl: string;
  appealRequested: boolean;
  appealApproved: boolean;
};

/**
 * RPC 节点是外部信任边界：这里仅校验 HTTP 成功、JSON-RPC error 与 result 的存在，
 * TypeScript 类型断言不会在运行时验证 `jsonrpc`、`id` 或 result 的字节结构。ABI 解码错误、
 * 网络错误和节点返回的合约 revert 均原样向上抛出，由调用方统一决定告警或重试；读适配器自身
 * 不缓存、不落盘，也不隐藏节点分叉或暂时不可用。
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
  if ("error" in payload) {
    throw new Error(`${method} returned JSON-RPC error ${payload.error.code}: ${payload.error.message}`);
  }

  if (!("result" in payload)) {
    throw new Error(`${method} response missing result`);
  }

  return payload.result;
}

export async function readAuditReportByIndex(
  options: ReadAuditReportByIndexOptions
): Promise<AuditReportByIndex> {
  // index 遵循合约数组的零基下标；链上的 auditId 则从 1 开始。重试斩罚流程依赖
  // `index === auditId - 1` 这一合约兼容约束，因此这里不对两者做隐式换算。
  const fetchImpl = options.fetchImpl ?? fetch;
  const callData = getAuditRegistryInterface().encodeFunctionData("getAuditReportByIndex", [
    options.tokenId,
    options.index
  ]) as `0x${string}`;
  const result = await jsonRpcRequest<`0x${string}`>(
    options.rpcUrl,
    "eth_call",
    [
      {
        to: options.contractAddress,
        data: callData
      },
      "latest"
    ],
    fetchImpl
  );
  const decoded = getAuditRegistryInterface().decodeFunctionResult(
    "getAuditReportByIndex",
    result
  )[0] as DecodedAuditRecord;

  // ABI 解码值仍来自不可信 RPC。所有整数在跨入 JavaScript number 边界时统一检查安全整数，
  // 防止大整数被静默舍入；哈希、CID 与 URL 保持链上原值，完整性/可访问性验证属于更上层。
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
    ...(decoded.evidenceRoot ? { evidenceRoot: decoded.evidenceRoot } : {}),
    ...(decoded.attestationHash ? { attestationHash: decoded.attestationHash } : {}),
    ...(decoded.evidenceCID ? { evidenceCID: decoded.evidenceCID } : {}),
    reportCID: decoded.reportCID,
    manifestUrl: decoded.manifestUrl,
    appealRequested: decoded.appealRequested,
    appealApproved: decoded.appealApproved
  };
}
