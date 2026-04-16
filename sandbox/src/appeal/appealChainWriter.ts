import { utils } from "ethers";

import { createJsonRpcWriteClient, type CreateJsonRpcWriteClientOptions } from "../chain/jsonRpcWriteClient.js";

export interface AppealChainWriterConfig {
  rpcUrl: string;
  contractAddress: string;
  chainId: number;
  operatorPrivateKey: string;
}

export interface FileAppealOnChainRequest {
  tokenId: string;
  auditId: string;
  evidenceHash: string;
  appealCID: string;
}

export interface ResolveAppealOnChainRequest {
  tokenId: string;
  appealId: string;
  outcome: "approved" | "rejected";
}

export interface AppealChainWriteResult {
  transactionHash: `0x${string}`;
}

export interface AppealChainWriter {
  fileAppealOnChain(request: FileAppealOnChainRequest): Promise<AppealChainWriteResult>;
  resolveAppealOnChain(request: ResolveAppealOnChainRequest): Promise<AppealChainWriteResult>;
}

export interface AppealChainWriterDependencies {
  createJsonRpcWriteClient?: (options: CreateJsonRpcWriteClientOptions) => ReturnType<typeof createJsonRpcWriteClient>;
}

// V2 contract ABI fragments for appeal functions
const FILE_APPEAL_ABI = "function fileAppeal(uint256 tokenId, uint64 auditId, bytes32 evidenceHash, string appealCID)";
const RESOLVE_APPEAL_ABI = "function resolveAppeal(uint256 tokenId, uint64 appealId, uint8 outcome)";

function parseDecimalBigInt(value: string, field: string): bigint {
  if (!/^\d+$/u.test(value.trim())) {
    throw new Error(`${field} must be a non-empty decimal string.`);
  }
  return BigInt(value.trim());
}

function parseDecimalNumber(value: string, field: string): number {
  if (!/^\d+$/u.test(value.trim())) {
    throw new Error(`${field} must be a non-empty decimal string.`);
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${field} must be a safe integer.`);
  }
  return parsed;
}

function normalizeBytes32(value: string): string {
  if (value.startsWith("0x")) {
    return utils.hexZeroPad(value, 32);
  }
  return utils.hexZeroPad(`0x${value}`, 32);
}

function outcomeToUint8(outcome: "approved" | "rejected"): number {
  // AppealOutcome enum: 0 = Pending, 1 = Approved, 2 = Rejected
  return outcome === "approved" ? 1 : 2;
}

export function readAppealChainWriterConfigFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): AppealChainWriterConfig | undefined {
  if (env.APPEAL_CHAIN_WRITER_ENABLED !== "true") {
    return undefined;
  }

  const rpcUrl = env.AUDIT_RPC_URL;
  const contractAddress = env.AUDIT_REGISTRY_V2_ADDRESS;
  const chainIdStr = env.AUDIT_CHAIN_ID;
  const operatorPrivateKey = env.AUDIT_OPERATOR_PRIVATE_KEY;

  if (!rpcUrl) throw new Error("AUDIT_RPC_URL is required when APPEAL_CHAIN_WRITER_ENABLED is true");
  if (!contractAddress) throw new Error("AUDIT_REGISTRY_V2_ADDRESS is required when APPEAL_CHAIN_WRITER_ENABLED is true");
  if (!chainIdStr) throw new Error("AUDIT_CHAIN_ID is required when APPEAL_CHAIN_WRITER_ENABLED is true");
  if (!operatorPrivateKey) throw new Error("AUDIT_OPERATOR_PRIVATE_KEY is required when APPEAL_CHAIN_WRITER_ENABLED is true");

  if (!utils.isHexString(operatorPrivateKey, 32)) {
    throw new Error("AUDIT_OPERATOR_PRIVATE_KEY must be a 32-byte hex private key");
  }

  return {
    rpcUrl: rpcUrl.trim(),
    contractAddress: contractAddress.trim(),
    chainId: Number.parseInt(chainIdStr.trim(), 10),
    operatorPrivateKey: operatorPrivateKey.trim()
  };
}

export function createAppealChainWriter(
  config: AppealChainWriterConfig,
  dependencies: AppealChainWriterDependencies = {}
): AppealChainWriter {
  const writeClient = (dependencies.createJsonRpcWriteClient ?? createJsonRpcWriteClient)({
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    privateKey: config.operatorPrivateKey
  });

  const fileAppealInterface = new utils.Interface([FILE_APPEAL_ABI]);
  const resolveAppealInterface = new utils.Interface([RESOLVE_APPEAL_ABI]);

  return {
    async fileAppealOnChain(request: FileAppealOnChainRequest): Promise<AppealChainWriteResult> {
      const tokenId = parseDecimalBigInt(request.tokenId, "tokenId");
      const auditId = parseDecimalNumber(request.auditId, "auditId");
      const evidenceHash = normalizeBytes32(request.evidenceHash);

      const data = fileAppealInterface.encodeFunctionData("fileAppeal", [
        tokenId,
        auditId,
        evidenceHash,
        request.appealCID
      ]);

      const receipt = await writeClient.submitTransaction({
        to: config.contractAddress,
        data: data as `0x${string}`
      });

      return { transactionHash: receipt.transactionHash };
    },

    async resolveAppealOnChain(request: ResolveAppealOnChainRequest): Promise<AppealChainWriteResult> {
      const tokenId = parseDecimalBigInt(request.tokenId, "tokenId");
      const appealId = parseDecimalNumber(request.appealId, "appealId");
      const outcome = outcomeToUint8(request.outcome);

      const data = resolveAppealInterface.encodeFunctionData("resolveAppeal", [
        tokenId,
        appealId,
        outcome
      ]);

      const receipt = await writeClient.submitTransaction({
        to: config.contractAddress,
        data: data as `0x${string}`
      });

      return { transactionHash: receipt.transactionHash };
    }
  };
}
