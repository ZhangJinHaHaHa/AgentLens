/**
 * marketplace 合约的只读浏览器适配器，提供访问权、定价、访问计数及最近访问记录查询，输入为地址/ABI/RPC/chainId 与 token/user。
 * 每个公开方法都会产生 JSON-RPC；访问记录先读总数，再按倒序最多串行读取二十条，单条失败跳过，外层失败则返回空数组。
 * 客户端没有缓存、超时、取消或自动重试；除记录列表外的合约错误原样拒绝，空列表因此可能表示“确实为空”或“读取失败”，上层应结合计数/状态展示。
 * RPC 和合约返回值属于外部信任边界，地址、ABI 与 bigint 转 number 未在此验证；`hasAccess` 的浏览器结果不能替代合约写入或服务端即时授权。
 * “最近二十条且保持新到旧顺序”是界面性能不变量，若需要完整账本应使用索引服务而不是扩大前端循环。
 */
import { Contract, JsonRpcProvider, type InterfaceAbi } from "ethers";

export interface AccessRecord {
  buyer: string;
  amountPaid: bigint;
  expiresAt: number;
  durationDays: number;
}

export interface MarketplaceClient {
  hasAccess(tokenId: bigint, userAddress: string): Promise<boolean>;
  getPricing(tokenId: bigint): Promise<{
    pricePerDay: bigint;
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
              amountPaid: r.amountPaid as bigint,
              expiresAt: Number(r.expiresAt),
              durationDays: Number(r.durationDays)
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
