/**
 * V1 外部 Edge 网络部署器：从固定产物创建静态 JSON-RPC provider 与签名钱包，部署注册表并把链上回执整理为网络级元数据文件。
 * 输入为经本文件解析的 `EDGE_*` 配置及可选依赖注入；输出同时是返回的 deployment 对象和 `<outputDir>/AgentAuditRegistry.json`。
 * 构造参数顺序固定为服务费、最低保证金、初始操作员；操作员缺省时使用部署钱包，回执中的实际 chainId、地址、交易哈希和区块号构成可追溯结果。
 * 信任边界跨越本地产物、RPC 节点和私钥签名者：静态网络声明不能替代对目标链与合约字节码的发布前核验，元数据中的 RPC URL 也不应包含凭据。
 * 配置/产物校验失败会在广播前终止；等待回执或写盘失败则可能发生在合约已经上链之后，因此重试不是幂等操作，必须先按交易哈希或部署者 nonce 查链。
 * 该文件使用旧版字段 `privateKey` 与 `initialServiceFeeWei`/`initialMinimumBondWei`，不可把 `deployConfig.js` 的 V2/V3 对象未经适配直接传入。
 */
const fs = require("fs");
const path = require("path");

const { ethers } = require("ethers");
const { createStaticJsonRpcProvider, waitForDeploymentMetadata } = require("./ethersDeployment");

const ARTIFACT_PATH = path.join(__dirname, "..", "artifacts", "AgentAuditRegistry.json");
const DEFAULT_NETWORK_NAME = "polygon-edge-test";
const DEFAULT_SERVICE_FEE_WEI = 0n;
const DEFAULT_MINIMUM_BOND_WEI = 1n;

function loadArtifact() {
  return JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
}

function parseRequiredInteger(value, variableName) {
  if (!value) {
    throw new Error(`${variableName} is required`);
  }

  if (!/^\d+$/u.test(value)) {
    throw new Error(`${variableName} must be a non-negative integer`);
  }

  return Number.parseInt(value, 10);
}

function parseRequiredPrivateKey(value, variableName) {
  if (!value) {
    throw new Error(`${variableName} is required`);
  }

  if (!ethers.isHexString(value, 32)) {
    throw new Error(`${variableName} must be a 32-byte hex private key`);
  }

  return value;
}

function parseOptionalAddress(value, variableName) {
  if (!value) {
    return undefined;
  }

  if (!ethers.isAddress(value)) {
    throw new Error(`${variableName} must be a valid EVM address`);
  }

  return value;
}

function parseOptionalBigNumber(value, variableName, fallbackValue) {
  if (!value) {
    return fallbackValue;
  }

  if (!/^\d+$/u.test(value)) {
    throw new Error(`${variableName} must be a non-negative integer string in wei`);
  }

  return BigInt(value);
}

function readEdgeDeploymentConfig(env = process.env) {
  if (!env.EDGE_RPC_URL) {
    throw new Error("EDGE_RPC_URL is required");
  }

  return {
    rpcUrl: env.EDGE_RPC_URL,
    chainId: parseRequiredInteger(env.EDGE_CHAIN_ID, "EDGE_CHAIN_ID"),
    privateKey: parseRequiredPrivateKey(
      env.EDGE_DEPLOYER_PRIVATE_KEY,
      "EDGE_DEPLOYER_PRIVATE_KEY"
    ),
    networkName: env.EDGE_NETWORK_NAME ?? DEFAULT_NETWORK_NAME,
    initialOperator: parseOptionalAddress(env.EDGE_INITIAL_OPERATOR, "EDGE_INITIAL_OPERATOR"),
    initialServiceFeeWei: parseOptionalBigNumber(
      env.EDGE_INITIAL_SERVICE_FEE_WEI,
      "EDGE_INITIAL_SERVICE_FEE_WEI",
      DEFAULT_SERVICE_FEE_WEI
    ),
    initialMinimumBondWei: parseOptionalBigNumber(
      env.EDGE_INITIAL_MINIMUM_BOND_WEI,
      "EDGE_INITIAL_MINIMUM_BOND_WEI",
      DEFAULT_MINIMUM_BOND_WEI
    )
  };
}

async function deployEdgeRegistry(config, dependencies = {}) {
  const outputDir =
    dependencies.outputDir ??
    path.join(__dirname, "..", "deployments", config.networkName);
  const provider =
    dependencies.createProvider?.(config) ??
    createStaticJsonRpcProvider(config);
  const wallet =
    dependencies.createWallet?.(config, provider) ??
    new ethers.Wallet(config.privateKey, provider);
  const artifact = loadArtifact();
  const factory =
    dependencies.createFactory?.({ artifact, wallet, provider, config }) ??
    new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const initialOperator = config.initialOperator ?? wallet.address;

  const contract = await factory.deploy(
    config.initialServiceFeeWei,
    config.initialMinimumBondWei,
    initialOperator
  );
  const { address, transactionHash, receipt } = await waitForDeploymentMetadata(contract);
  const network = await provider.getNetwork();

  const deployment = {
    contractName: "AgentAuditRegistry",
    networkName: config.networkName,
    chainId: String(network.chainId),
    rpcUrl: config.rpcUrl,
    address,
    deployTransactionHash: transactionHash,
    deployedBlockNumber: receipt.blockNumber,
    deployer: wallet.address,
    constructorArgs: {
      initialServiceFeeWei: config.initialServiceFeeWei.toString(),
      initialMinimumBondWei: config.initialMinimumBondWei.toString(),
      initialOperator
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
  readEdgeDeploymentConfig,
  deployEdgeRegistry
};
