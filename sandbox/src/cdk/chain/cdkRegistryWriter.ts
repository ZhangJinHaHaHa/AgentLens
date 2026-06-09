import { getCdkV2Interface } from "./cdkArtifact";
import type { CdkConfig, RegisterResult } from "../cdkTypes";
import {
  createJsonRpcWriteClient,
  type JsonRpcWriteClient
} from "../../chain/jsonRpcWriteClient";

export interface CdkRegistryWriterOptions {
  config: CdkConfig;
  writeClient?: JsonRpcWriteClient;
}

function buildWriteClient(config: CdkConfig): JsonRpcWriteClient {
  if (!config.privateKey) {
    throw new Error("privateKey is required for write operations. Set SHENJI_CDK_PRIVATE_KEY.");
  }

  return createJsonRpcWriteClient({
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    privateKey: config.privateKey
  });
}

export async function stakeAgent(
  options: CdkRegistryWriterOptions,
  agentName: string,
  manifestUrl: string,
  stakeValue: bigint
): Promise<RegisterResult> {
  const client = options.writeClient ?? buildWriteClient(options.config);
  const iface = getCdkV2Interface();

  const callData = iface.encodeFunctionData("stake", [agentName, manifestUrl]) as `0x${string}`;

  const receipt = await client.submitTransaction({
    to: options.config.registryAddress,
    data: callData,
    value: stakeValue
  });

  const agentRegisteredTopic = iface.getEventTopic("AgentRegistered");
  const registeredLog = (receipt.logs ?? []).find(
    (log) => log.topics[0] === agentRegisteredTopic
  );

  let tokenId: bigint;
  if (registeredLog && registeredLog.topics[1]) {
    tokenId = BigInt(registeredLog.topics[1]);
  } else {
    throw new Error("AgentRegistered event not found in transaction logs");
  }

  return {
    tokenId,
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber
  };
}
