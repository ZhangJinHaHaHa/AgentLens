/**
 * 租赁交易的最小写入边界：使用用户 signer 调用 marketplace `rentAgent`，附带 wei 价值，等待交易确认后返回哈希。
 * 输入含合约地址、token、租期和金额；函数会触发钱包授权、链上广播与确认等待，不维护本地状态、余额缓存或交易队列。
 * 前端不验证地址、目标链、租期和报价新鲜度，钱包及合约才是权威校验边界；调用方应在签名前展示并复核当前链与实际 value。
 * 用户拒绝、revert、掉线或确认失败均直接抛出且不自动重试；广播后结果未知时应先按哈希查链，避免重复租赁或重复付款。
 * 返回哈希表示交易已等待完成，不等同于服务端会话已开通，访问状态仍须从合约重新读取。
 */
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
