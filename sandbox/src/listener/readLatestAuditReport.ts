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
 * “latest”表示注册表当前最后一条审计记录，而不是经过确认数约束的不可逆快照。该对象常被
 * 写回重试用于核对链上事实，消费方仍须逐字段确认目标写回，不能仅凭“最新”或非 Pending 状态
 * 判断某个 eventKey 已经成功提交。
 */
export interface LatestAuditReport {
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

export interface ReadLatestAuditReportOptions {
  rpcUrl: string;
  contractAddress: string;
  tokenId: bigint;
  fetchImpl?: typeof fetch;
}

type DecodedLatestAuditReport = {
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
 * 此函数把 JSON-RPC 当作传输边界而非可信数据源：只处理 HTTP 状态、显式 RPC error 和缺失
 * result，随后由合约 ABI 负责结构解码。响应声明的版本/id 未做运行时模式校验；任何网络、解析、
 * revert 或 ABI 不兼容错误都会抛给队列协调层，以免把“读失败”误判为链上 Pending。
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

export async function readLatestAuditReport(
  options: ReadLatestAuditReportOptions
): Promise<LatestAuditReport> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const callData = getAuditRegistryInterface().encodeFunctionData("getLatestAuditReport", [
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
      // 固定使用 latest 保持与 listener 写回核对的现有语义；这里不等待确认块，也不持久化块号，
      // 因而链重组/节点滞后需要由部署侧的 RPC 选择和上层重试策略吸收。
      "latest"
    ],
    fetchImpl
  );
  const decoded = getAuditRegistryInterface().decodeFunctionResult(
    "getLatestAuditReport",
    result
  )[0] as DecodedLatestAuditReport;

  // 数值字段经安全整数转换后才暴露给业务层；其余字段忠实保留链上表示。可选证据字段是
  // 面向旧数据形态的兼容面，不在读取阶段下载 CID、验证哈希或建立证明可信度。
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
