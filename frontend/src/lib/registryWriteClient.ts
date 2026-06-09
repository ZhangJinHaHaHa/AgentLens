import { Contract, JsonRpcProvider, type InterfaceAbi, type JsonRpcSigner } from "ethers";

import registryArtifact from "../../../contracts/artifacts/AgentAuditRegistryV3.json";
import type { AppConfig } from "@/config/appConfig";

export interface PublishPricing {
  serviceFee: bigint;
  minimumBond: bigint;
  totalRequired: bigint;
}

export interface StakeAgentInput {
  agentName: string;
  manifestUrl: string;
  valueWei: bigint;
}

export async function getPublishPricing(config: AppConfig): Promise<PublishPricing> {
  const contract = new Contract(
    config.registryAddress,
    registryArtifact.abi as InterfaceAbi,
    new JsonRpcProvider(config.rpcUrl, config.chainId)
  );
  const [serviceFee, minimumBond] = await Promise.all([
    contract.serviceFee() as Promise<bigint>,
    contract.minimumBond() as Promise<bigint>
  ]);

  return {
    serviceFee,
    minimumBond,
    totalRequired: serviceFee + minimumBond
  };
}

export async function stakeAgent(
  config: AppConfig,
  signer: JsonRpcSigner,
  input: StakeAgentInput
): Promise<{ hash: string; tokenId: bigint }> {
  const contract = new Contract(config.registryAddress, registryArtifact.abi as InterfaceAbi, signer);
  const tx = await contract.stake(input.agentName, input.manifestUrl, { value: input.valueWei });
  await tx.wait();

  const developer = await signer.getAddress();
  const tokenId = await readTokenId(config, developer, input.agentName);
  return { hash: tx.hash as string, tokenId };
}

export async function readTokenId(
  config: AppConfig,
  developer: string,
  agentName: string
): Promise<bigint> {
  const contract = new Contract(
    config.registryAddress,
    registryArtifact.abi as InterfaceAbi,
    new JsonRpcProvider(config.rpcUrl, config.chainId)
  );
  return contract.getTokenId(developer, agentName) as Promise<bigint>;
}
