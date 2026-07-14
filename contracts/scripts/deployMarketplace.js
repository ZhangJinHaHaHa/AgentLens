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
