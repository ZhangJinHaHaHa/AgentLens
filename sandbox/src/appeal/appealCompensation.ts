import { utils } from "ethers";

import { createJsonRpcWriteClient, type CreateJsonRpcWriteClientOptions } from "../chain/jsonRpcWriteClient";
import { getAuditRegistryInterface } from "../listener/auditRegistryArtifact";
import { writeCompensateBond, type WriteCompensateBondRequest } from "../listener/writeCompensateBond";

export interface AppealCompensationConfig {
  rpcUrl: string;
  contractAddress: string;
  chainId: number;
  operatorPrivateKey: string;
}

export interface AppealCompensationRequest {
  tokenId: string;
  auditId: string;
  amount: string;
  reasonCode: string;
}

export interface AppealCompensationResult {
  transactionHash: `0x${string}`;
}

export type AppealCompensationExecutor = (
  request: AppealCompensationRequest
) => Promise<AppealCompensationResult>;

export interface CreateAppealCompensationDependencies {
  createJsonRpcWriteClient?: (
    options: CreateJsonRpcWriteClientOptions
  ) => ReturnType<typeof createJsonRpcWriteClient>;
  writeCompensateBond?: (
    request: WriteCompensateBondRequest,
    deps: Parameters<typeof writeCompensateBond>[1]
  ) => Promise<unknown>;
}

function parseRequiredInteger(value: string | undefined, variableName: string): number {
  if (!value) {
    throw new Error(`${variableName} is required when AUDIT_APPEAL_COMPENSATION_ENABLED is true`);
  }

  if (!/^\d+$/u.test(value)) {
    throw new Error(`${variableName} must be a non-negative integer`);
  }

  return Number.parseInt(value, 10);
}

function parseRequiredString(value: string | undefined, variableName: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${variableName} is required when AUDIT_APPEAL_COMPENSATION_ENABLED is true`);
  }

  return value.trim();
}

function parseRequiredPrivateKey(value: string | undefined): string {
  const privateKey = parseRequiredString(value, "AUDIT_OPERATOR_PRIVATE_KEY");
  if (!utils.isHexString(privateKey, 32)) {
    throw new Error("AUDIT_OPERATOR_PRIVATE_KEY must be a 32-byte hex private key");
  }

  return privateKey;
}

export function readAppealCompensationConfigFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): AppealCompensationConfig | undefined {
  if (env.AUDIT_APPEAL_COMPENSATION_ENABLED !== "true") {
    return undefined;
  }

  return {
    rpcUrl: parseRequiredString(env.AUDIT_RPC_URL, "AUDIT_RPC_URL"),
    contractAddress: parseRequiredString(env.AUDIT_REGISTRY_ADDRESS, "AUDIT_REGISTRY_ADDRESS"),
    chainId: parseRequiredInteger(env.AUDIT_CHAIN_ID, "AUDIT_CHAIN_ID"),
    operatorPrivateKey: parseRequiredPrivateKey(env.AUDIT_OPERATOR_PRIVATE_KEY)
  };
}

function parseDecimalBigInt(value: string, field: string): bigint {
  if (!/^\d+$/u.test(value.trim())) {
    throw new Error(`${field} must be a non-empty decimal string.`);
  }

  return BigInt(value.trim());
}

function parseDecimalInteger(value: string, field: string): number {
  if (!/^\d+$/u.test(value.trim())) {
    throw new Error(`${field} must be a non-empty decimal string.`);
  }

  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${field} must be a safe integer.`);
  }

  return parsed;
}

export function createAppealCompensationExecutor(
  config: AppealCompensationConfig,
  dependencies: CreateAppealCompensationDependencies = {}
): AppealCompensationExecutor {
  const writeClient = (dependencies.createJsonRpcWriteClient ?? createJsonRpcWriteClient)({
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    privateKey: config.operatorPrivateKey
  });
  const auditRegistryInterface = getAuditRegistryInterface();

  return async (request: AppealCompensationRequest): Promise<AppealCompensationResult> => {
    const receipt = await (dependencies.writeCompensateBond ?? writeCompensateBond)(
      {
        tokenId: parseDecimalBigInt(request.tokenId, "tokenId"),
        auditId: parseDecimalInteger(request.auditId, "auditId"),
        amount: parseDecimalBigInt(request.amount, "amount"),
        reasonCode: request.reasonCode
      },
      {
        submitContractCall: async (call) =>
          writeClient.submitTransaction({
            to: config.contractAddress,
            data: auditRegistryInterface.encodeFunctionData(
              "compensateBond",
              [call.args.tokenId, call.args.auditId, call.args.amount, call.args.reasonCode]
            ) as `0x${string}`
          })
      }
    );

    const transactionHash = (receipt as { transactionHash?: `0x${string}` }).transactionHash;
    if (!transactionHash) {
      throw new Error("compensateBond submission did not return a transaction hash.");
    }

    return { transactionHash };
  };
}
