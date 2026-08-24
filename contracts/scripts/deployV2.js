/**
 * V2 注册表部署单元：读取 `AgentAuditRegistryV2` 产物，以共享 Edge 配置构造合约，并把确认后的地址和构造参数写入网络目录。
 * 输入 config 的费用/保证金是规范化十进制 wei 字符串，操作员空值回退为钱包地址；可注入 provider、wallet、factory 供隔离验证，输出为 metadata 对象和 JSON。
 * 构造参数及产物 ABI 必须同属 V2，注入对象也必须连接同一目标链和签名身份；本函数不会交叉校验这些依赖，调用方承担该测试/发布信任边界。
 * V2 是新地址上的完整状态实例，不读取 V1 状态、也不执行代理升级或迁移；文件名稳定不等于与既有地址向后兼容。
 * 交易等待失败或文件写入失败都可能留下已部署但未登记的实例，故自动重试前必须查询部署交易；目标元数据文件会被直接覆盖而非版本化追加。
 * ethers provider、钱包和 factory 的异常原样向上传播，脚本不做重试、确认数策略或 runtime bytecode 比对。
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { readRegistryDeploymentConfig } = require("./deployConfig");
const { createStaticJsonRpcProvider, waitForDeploymentMetadata } = require("./ethersDeployment");

const artifactPath = path.join(__dirname, "..", "artifacts", "AgentAuditRegistryV2.json");
const deploymentsDir = path.join(__dirname, "..", "deployments");

function readV2DeploymentConfig(env) {
  return readRegistryDeploymentConfig(env);
}

async function deployV2Registry(config, dependencies = {}) {
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
    contractName: "AgentAuditRegistryV2",
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
  const metadataPath = path.join(networkDir, "AgentAuditRegistryV2.json");
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  return metadata;
}

module.exports = { deployV2Registry, readV2DeploymentConfig };
