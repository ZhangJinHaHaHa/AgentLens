import { Contract, JsonRpcProvider, type InterfaceAbi } from "ethers";

export interface AccessRecord {
  buyer: string;
  isRental: boolean;
  amountPaid: bigint;
  expiresAt: number;
}

export interface MarketplaceClient {
  hasAccess(tokenId: bigint, userAddress: string): Promise<boolean>;
  getPricing(tokenId: bigint): Promise<{
    pricePerDay: bigint;
    buyPrice: bigint;
    configured: boolean;
  }>;
  getAccessCount(tokenId: bigint): Promise<bigint>;
  getAccessRecords(tokenId: bigint): Promise<AccessRecord[]>;
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
    },
    getAccessCount(tokenId) {
      return contract.getAccessCount(tokenId);
    },
    async getAccessRecords(tokenId): Promise<AccessRecord[]> {
      try {
        const count: bigint = await contract.getAccessCount(tokenId);
        const n = Number(count);
        if (n === 0) return [];
        // Fetch all records via index — contract stores _accessRecords[tokenId] array
        // We read up to 20 most recent records
        const limit = Math.min(n, 20);
        const records: AccessRecord[] = [];
        for (let i = n - 1; i >= n - limit; i--) {
          try {
            const r = await contract.getAccessRecord(tokenId, i);
            records.push({
              buyer: r.buyer as string,
              isRental: r.isRental as boolean,
              amountPaid: r.amountPaid as bigint,
              expiresAt: Number(r.expiresAt)
            });
          } catch {
            // individual record fetch failed, skip
          }
        }
        return records;
      } catch {
        return [];
      }
    }
  };
}
