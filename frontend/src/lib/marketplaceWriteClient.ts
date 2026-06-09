import { Contract, type InterfaceAbi, type JsonRpcSigner } from "ethers";

import marketplaceArtifact from "../../../contracts/artifacts/AgentMarketplace.json";

export interface RentAgentInput {
  marketplaceAddress: string;
  signer: JsonRpcSigner;
  tokenId: bigint;
  durationDays: number;
  valueWei: bigint;
}

export async function rentAgent(input: RentAgentInput): Promise<{ hash: string }> {
  const contract = new Contract(
    input.marketplaceAddress,
    marketplaceArtifact.abi as InterfaceAbi,
    input.signer
  );
  const tx = await contract.rentAgent(input.tokenId, input.durationDays, { value: input.valueWei });
  await tx.wait();
  return { hash: tx.hash as string };
}
