/**
 * 本地 V1 部署适配器：连接 Hardhat 内存网络，以首个 signer 部署、第二个 signer 作为操作员，并写出供本地联调读取的部署描述。
 * 输入只有可选 `outputDir`；固定使用 V1 产物、0 wei 服务费和 1 wei 最低保证金，输出 deployment 对象及 local 目录中的 JSON 元数据。
 * 此处的账户、链 ID 与合约状态属于进程内开发信任域，重启或新建 Hardhat 连接后不保证继续存在，绝不能把该地址当作外部网络部署证明。
 * 必须至少取得两个 signer，且构造参数顺序与 V1 ABI 保持一致；记录的地址和区块号只在返回的 Hardhat 网络实例中有意义。
 * 产物读取、网络初始化、交易等待或写盘均可能抛错；若写盘阶段失败，交易可能已确认，直接重跑会产生另一个地址而不是恢复原部署。
 * 本入口不接受费用或操作员覆盖项，面向确定性的测试默认值；需要真实 RPC、密钥与网络命名时使用 Edge 部署路径。
 */
const fs = require("fs");
const path = require("path");

const { waitForDeploymentMetadata } = require("./ethersDeployment");
const { getHardhatConnection } = require("./hardhatConnection");

const ARTIFACT_PATH = path.join(__dirname, "..", "artifacts", "AgentAuditRegistry.json");
const DEFAULT_DEPLOYMENT_DIR = path.join(__dirname, "..", "deployments", "local");
const DEFAULT_SERVICE_FEE_WEI = 0n;
const DEFAULT_MINIMUM_BOND_WEI = 1n;

function loadArtifact() {
  return JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
}

async function deployLocalRegistry(options = {}) {
  const outputDir = options.outputDir ?? DEFAULT_DEPLOYMENT_DIR;
  const connection = await getHardhatConnection();
  const { ethers } = connection;
  const [deployer, operator] = await ethers.getSigners();
  const artifact = loadArtifact();
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);

  const contract = await factory.deploy(
    DEFAULT_SERVICE_FEE_WEI,
    DEFAULT_MINIMUM_BOND_WEI,
    operator.address
  );
  const { address, transactionHash, receipt } = await waitForDeploymentMetadata(contract);
  const network = await ethers.provider.getNetwork();

  const deployment = {
    contractName: "AgentAuditRegistry",
    networkName: connection.networkName,
    chainId: String(network.chainId),
    address,
    deployTransactionHash: transactionHash,
    deployedBlockNumber: receipt.blockNumber,
    deployer: deployer.address,
    constructorArgs: {
      initialServiceFeeWei: DEFAULT_SERVICE_FEE_WEI.toString(),
      initialMinimumBondWei: DEFAULT_MINIMUM_BOND_WEI.toString(),
      initialOperator: operator.address
    },
    artifactPath: ARTIFACT_PATH
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "AgentAuditRegistry.json"),
    `${JSON.stringify(deployment, null, 2)}\n`
  );

  return deployment;
}

module.exports = {
  deployLocalRegistry
};
