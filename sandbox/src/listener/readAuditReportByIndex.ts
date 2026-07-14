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
