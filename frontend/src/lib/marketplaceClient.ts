import { Contract, JsonRpcProvider, type InterfaceAbi } from "ethers";

export interface MarketplaceClient {
  hasAccess(tokenId: bigint, userAddress: string): Promise<boolean>;
  getPricing(tokenId: bigint): Promise<{
    pricePerDay: bigint;
    buyPrice: bigint;
    configured: boolean;
  }>;
}

export function createMarketplaceClient(
  contractAddress: string,
  abi: InterfaceAbi,
  rpcUrl: string,
  chainId: number
): MarketplaceClient {
  const provider = new JsonRpcProvider(rpcUrl, chainId);
  const contract = new Contract(contractAddress, abi, provider);

  return {
    hasAccess(tokenId, userAddress) {
      return contract.hasAccess(tokenId, userAddress);
    },
    getPricing(tokenId) {
      return contract.getPricing(tokenId);
    }
  };
}
