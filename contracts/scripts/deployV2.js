const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { readRegistryDeploymentConfig } = require("./deployConfig");

const artifactPath = path.join(__dirname, "..", "artifacts", "AgentAuditRegistryV2.json");
const deploymentsDir = path.join(__dirname, "..", "deployments");

function readV2DeploymentConfig(env) {
  return readRegistryDeploymentConfig(env);
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
