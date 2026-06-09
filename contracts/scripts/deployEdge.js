const fs = require("fs");
const path = require("path");

const { ethers, utils } = require("ethers");

const ARTIFACT_PATH = path.join(__dirname, "..", "artifacts", "AgentAuditRegistry.json");
const DEFAULT_NETWORK_NAME = "polygon-edge-test";
const DEFAULT_SERVICE_FEE_WEI = ethers.constants.Zero;
const DEFAULT_MINIMUM_BOND_WEI = ethers.constants.One;

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

  if (!utils.isHexString(value, 32)) {
    throw new Error(`${variableName} must be a 32-byte hex private key`);
  }

  return value;
}

function parseOptionalAddress(value, variableName) {
  if (!value) {
    return undefined;
  }

  if (!utils.isAddress(value)) {
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

  return ethers.BigNumber.from(value);
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
    new ethers.providers.StaticJsonRpcProvider(config.rpcUrl, {
      chainId: config.chainId,
      name: config.networkName
    });
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
  const receipt = await contract.deployTransaction.wait();
  const network = await provider.getNetwork();

  const deployment = {
    contractName: "AgentAuditRegistry",
    networkName: config.networkName,
    chainId: String(network.chainId),
    rpcUrl: config.rpcUrl,
    address: contract.address,
    deployTransactionHash: contract.deployTransaction.hash,
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
