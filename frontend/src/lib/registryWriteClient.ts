/**
 * Registry V3 发布边界：并发读取服务费与最低保证金，或用用户 signer 执行 stake，确认后再按开发者地址和 agentName 回读 tokenId。
 * 方法会访问 JSON-RPC，stake 还会触发钱包签名、广播及确认等待；输出分别是 bigint 定价合计或交易哈希/tokenId，不保存客户端状态或缓存报价。
 * 配置、名称、manifest URL、付款额与目标网络未在此校验，浏览器输入不可信，合约和服务端发布策略必须重新验证；读取报价也可能在签名前变化。
 * 任一 RPC、签名、revert、确认或回读错误都会原样抛出，不自动重试；若广播结果不确定，应先查询交易/事件，不能直接重复 stake。
 * tokenId 由 signer 地址与原名称从权威合约派生，调用方不得从交易哈希或本地计数自行推断；所有金额计算保持 bigint 精度。
 */
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
