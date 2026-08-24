/**
 * V3/MDDRM 注册表发布器：把 V3 ABI/字节码部署到指定 Edge 网络，并记录声誉衰减版本实例的链上定位信息。
 * 输入沿用共享配置的 `serviceFeeWei`、`minimumBondWei` 与部署者密钥，可由调用方替换 provider/wallet/factory；输出覆盖网络目录下的 V3 元数据文件。
 * 操作员缺省取签名钱包，三个构造参数的值和顺序必须与 V3 产物一致；依赖注入不会自动证明 provider、wallet、factory 相互匹配。
 * 此发布不会继承 V2 的身份、审计、申诉或声誉存储，V3 版本号表示独立合约语义而非可升级代理槽位，迁移责任在链外编排层。
 * RPC、私钥、产物来源和确认回执构成部署信任边界；脚本只保存定位元数据，不验证部署后代码哈希或初始化状态。
 * 广播后等待或落盘失败会造成“链上成功、登记缺失”的部分完成状态，重跑可能重复部署；恢复应优先核对 nonce/交易回执，而非无条件重试。
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { readRegistryDeploymentConfig } = require("./deployConfig");
const { createStaticJsonRpcProvider, waitForDeploymentMetadata } = require("./ethersDeployment");

const artifactPath = path.join(__dirname, "..", "artifacts", "AgentAuditRegistryV3.json");
const deploymentsDir = path.join(__dirname, "..", "deployments");

function readV3DeploymentConfig(env) {
  return readRegistryDeploymentConfig(env);
}

async function deployV3Registry(config, dependencies = {}) {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const provider = dependencies.provider ??
    createStaticJsonRpcProvider(config);
  const wallet = dependencies.wallet ??
    new ethers.Wallet(config.deployerPrivateKey, provider);

  const operatorAddress = config.initialOperator || wallet.address;

  const factory = dependencies.factory ??
    new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  const contract = await factory.deploy(
    config.serviceFeeWei,
    config.minimumBondWei,
    operatorAddress
  );

  const { address, transactionHash, receipt } = await waitForDeploymentMetadata(contract);

  const metadata = {
    contractName: "AgentAuditRegistryV3",
    networkName: config.networkName,
    chainId: String(config.chainId),
    rpcUrl: config.rpcUrl,
    address,
    deployTransactionHash: transactionHash,
    deployedBlockNumber: receipt.blockNumber,
    deployer: wallet.address,
    constructorArgs: {
      initialServiceFeeWei: config.serviceFeeWei,
      initialMinimumBondWei: config.minimumBondWei,
      initialOperator: operatorAddress
    }
  };

  const networkDir = path.join(deploymentsDir, config.networkName);
  fs.mkdirSync(networkDir, { recursive: true });
  const metadataPath = path.join(networkDir, "AgentAuditRegistryV3.json");
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  return metadata;
}

module.exports = { deployV3Registry, readV3DeploymentConfig };
