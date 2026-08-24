/**
 * 市场与评价组件的有序部署事务编排：先发布 `AgentMarketplace`，再把其实际地址作为 `AgentReviewRegistry` 的唯一构造依赖。
 * 输入是经共享解析器收敛后的 RPC、链 ID、部署密钥、网络名与可选操作员；输出为两份部署元数据文件及包含二者的返回对象。
 * 两个合约必须由同一钱包在同一 provider 上依次部署，评价合约信任第一个回执地址的 `hasAccess` 结果；改变顺序或跨链拼接地址会破坏访问校验边界。
 * 本地 ABI/字节码、RPC 返回和部署账户均属于发布信任面，脚本不会验证链上 runtime bytecode，也不会把密钥写入元数据。
 * 第二笔交易失败时市场可能已经生效，但本实现尚未写任何元数据；写入两份文件也不是原子操作，恢复前应先查链，避免重复部署或地址配对错误。
 * 市场与评价注册表是独立合约而非代理升级，现有消费者依赖固定文件名与 `marketplaceAddress` 构造记录；替换任一地址需要同步更新下游配置。
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { readRegistryDeploymentConfig } = require("./deployConfig");
const { createStaticJsonRpcProvider, waitForDeploymentMetadata } = require("./ethersDeployment");

const artifactsDir = path.join(__dirname, "..", "artifacts");
const deploymentsDir = path.join(__dirname, "..", "deployments");

function loadArtifact(name) {
  return JSON.parse(fs.readFileSync(path.join(artifactsDir, `${name}.json`), "utf8"));
}

function readMarketplaceDeploymentConfig(env) {
  const config = readRegistryDeploymentConfig(env);
  return {
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    deployerPrivateKey: config.deployerPrivateKey,
    networkName: config.networkName,
    initialOperator: config.initialOperator
  };
}

async function deployMarketplaceAndReview(config) {
  const provider = createStaticJsonRpcProvider(config);
  const wallet = new ethers.Wallet(config.deployerPrivateKey, provider);
  const operatorAddress = config.initialOperator || wallet.address;

  // Deploy AgentMarketplace
  const mpArtifact = loadArtifact("AgentMarketplace");
  const mpFactory = new ethers.ContractFactory(mpArtifact.abi, mpArtifact.bytecode, wallet);
  const mpContract = await mpFactory.deploy(operatorAddress);
  const mpDeployment = await waitForDeploymentMetadata(mpContract);

  const mpMetadata = {
    contractName: "AgentMarketplace",
    networkName: config.networkName,
    chainId: String(config.chainId),
    rpcUrl: config.rpcUrl,
    address: mpDeployment.address,
    deployTransactionHash: mpDeployment.transactionHash,
    deployedBlockNumber: mpDeployment.receipt.blockNumber,
    deployer: wallet.address,
    constructorArgs: { initialOperator: operatorAddress }
  };

  // Deploy AgentReviewRegistry (depends on marketplace address)
  const rrArtifact = loadArtifact("AgentReviewRegistry");
  const rrFactory = new ethers.ContractFactory(rrArtifact.abi, rrArtifact.bytecode, wallet);
  const rrContract = await rrFactory.deploy(mpDeployment.address);
  const rrDeployment = await waitForDeploymentMetadata(rrContract);

  const rrMetadata = {
    contractName: "AgentReviewRegistry",
    networkName: config.networkName,
    chainId: String(config.chainId),
    rpcUrl: config.rpcUrl,
    address: rrDeployment.address,
    deployTransactionHash: rrDeployment.transactionHash,
    deployedBlockNumber: rrDeployment.receipt.blockNumber,
    deployer: wallet.address,
    constructorArgs: { marketplaceAddress: mpDeployment.address }
  };

  // Write metadata
  const networkDir = path.join(deploymentsDir, config.networkName);
  fs.mkdirSync(networkDir, { recursive: true });
  fs.writeFileSync(
    path.join(networkDir, "AgentMarketplace.json"),
    `${JSON.stringify(mpMetadata, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(networkDir, "AgentReviewRegistry.json"),
    `${JSON.stringify(rrMetadata, null, 2)}\n`
  );

  return { marketplace: mpMetadata, reviewRegistry: rrMetadata };
}

module.exports = { deployMarketplaceAndReview, readMarketplaceDeploymentConfig };
