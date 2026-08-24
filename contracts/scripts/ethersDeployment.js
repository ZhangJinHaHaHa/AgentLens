/**
 * ethers 部署公共边界：依据显式 chainId/name 创建静态 JSON-RPC provider，并把不同合约对象形态归一为地址、部署交易哈希和回执。
 * `createStaticJsonRpcProvider` 的输入来自部署配置，输出假定网络身份在 provider 生命周期内不变；RPC 仍是不可信远端，静态声明不是链真实性证明。
 * `waitForDeploymentMetadata` 接受 ethers v6 的 `waitForDeployment`/`deploymentTransaction`，同时兼容旧对象的 `deployTransaction`/`address` 字段。
 * 成功不变量是交易对象可等待，且最终地址、hash、receipt 三者都存在；返回值不增加业务字段，由各部署器负责记录构造参数与网络上下文。
 * 网络超时、交易替换/失败、合约对象形状不受支持或回执信息不完整都会抛错；函数不拥有重试、超时和额外确认数策略，调用者须处理已广播状态。
 */
const { ethers } = require("ethers");

function createStaticJsonRpcProvider(config) {
  return new ethers.JsonRpcProvider(
    config.rpcUrl,
    { chainId: config.chainId, name: config.networkName },
    { staticNetwork: true }
  );
}

async function waitForDeploymentMetadata(contract) {
  if (typeof contract.waitForDeployment === "function") {
    await contract.waitForDeployment();
  }
  const transaction = typeof contract.deploymentTransaction === "function"
    ? contract.deploymentTransaction()
    : contract.deployTransaction;
  if (!transaction || typeof transaction.wait !== "function") {
    throw new Error("Contract deployment transaction is unavailable.");
  }
  const receipt = await transaction.wait();
  const address = typeof contract.getAddress === "function"
    ? await contract.getAddress()
    : contract.address;
  if (!address || !transaction.hash || !receipt) {
    throw new Error("Contract deployment metadata is incomplete.");
  }
  return { address, transactionHash: transaction.hash, receipt };
}

module.exports = { createStaticJsonRpcProvider, waitForDeploymentMetadata };
