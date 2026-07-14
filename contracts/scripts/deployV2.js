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
