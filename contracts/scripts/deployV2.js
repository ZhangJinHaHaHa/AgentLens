const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const artifactPath = path.join(__dirname, "..", "artifacts", "AgentAuditRegistryV2.json");
const deploymentsDir = path.join(__dirname, "..", "deployments");

function readV2DeploymentConfig(env) {
  const rpcUrl = env.EDGE_RPC_URL;
  const chainId = env.EDGE_CHAIN_ID;
  const deployerPrivateKey = env.EDGE_DEPLOYER_PRIVATE_KEY;

  if (!rpcUrl) throw new Error("EDGE_RPC_URL is required");
  if (!chainId) throw new Error("EDGE_CHAIN_ID is required");
  if (!deployerPrivateKey) throw new Error("EDGE_DEPLOYER_PRIVATE_KEY is required");

  return {
    rpcUrl,
    chainId: Number(chainId),
    deployerPrivateKey,
    networkName: env.EDGE_NETWORK_NAME || "polygon-edge-test",
    initialOperator: env.EDGE_INITIAL_OPERATOR || "",
    serviceFeeWei: env.EDGE_INITIAL_SERVICE_FEE_WEI || "10000000000000000",
    minimumBondWei: env.EDGE_INITIAL_MINIMUM_BOND_WEI || "1000000000000000000"
  };
}

async function deployV2Registry(config, dependencies = {}) {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const provider = dependencies.provider ??
    new ethers.providers.StaticJsonRpcProvider(config.rpcUrl, {
      chainId: config.chainId,
      name: config.networkName
    });
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

  const receipt = await contract.deployTransaction.wait();

  const metadata = {
    contractName: "AgentAuditRegistryV2",
    networkName: config.networkName,
    chainId: String(config.chainId),
    rpcUrl: config.rpcUrl,
    address: contract.address,
    deployTransactionHash: contract.deployTransaction.hash,
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
