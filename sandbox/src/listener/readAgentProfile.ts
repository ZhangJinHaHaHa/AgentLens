import { BigNumber } from "ethers";

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
  tokenId: BigNumber;
  totalBond: BigNumber;
  blacklisted: boolean;
  createdAt: BigNumber;
  lastAuditAt: BigNumber;
  auditCount: number;
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

export async function readAgentProfile(
  options: ReadAgentProfileOptions
): Promise<AgentProfileOnChain> {
  const fetchImpl = options.fetchImpl ?? fetch;
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
      "latest"
    ],
    fetchImpl
  );
  const decoded = getAuditRegistryInterface().decodeFunctionResult(
    "getAgentProfile",
    result
  )[0] as DecodedAgentProfile;

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
