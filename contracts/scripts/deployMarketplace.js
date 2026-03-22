const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const artifactsDir = path.join(__dirname, "..", "artifacts");
const deploymentsDir = path.join(__dirname, "..", "deployments");

function loadArtifact(name) {
  return JSON.parse(fs.readFileSync(path.join(artifactsDir, `${name}.json`), "utf8"));
}

function readMarketplaceDeploymentConfig(env) {
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
    initialOperator: env.EDGE_INITIAL_OPERATOR || ""
  };
}

async function deployMarketplaceAndReview(config) {
  const provider = new ethers.providers.StaticJsonRpcProvider(config.rpcUrl, {
    chainId: config.chainId,
    name: config.networkName
  });
  const wallet = new ethers.Wallet(config.deployerPrivateKey, provider);
  const operatorAddress = config.initialOperator || wallet.address;

  // Deploy AgentMarketplace
  const mpArtifact = loadArtifact("AgentMarketplace");
  const mpFactory = new ethers.ContractFactory(mpArtifact.abi, mpArtifact.bytecode, wallet);
  const mpContract = await mpFactory.deploy(operatorAddress);
  const mpReceipt = await mpContract.deployTransaction.wait();

  const mpMetadata = {
    contractName: "AgentMarketplace",
    networkName: config.networkName,
    chainId: String(config.chainId),
    rpcUrl: config.rpcUrl,
    address: mpContract.address,
    deployTransactionHash: mpContract.deployTransaction.hash,
    deployedBlockNumber: mpReceipt.blockNumber,
    deployer: wallet.address,
    constructorArgs: { initialOperator: operatorAddress }
  };

  // Deploy AgentReviewRegistry (depends on marketplace address)
  const rrArtifact = loadArtifact("AgentReviewRegistry");
  const rrFactory = new ethers.ContractFactory(rrArtifact.abi, rrArtifact.bytecode, wallet);
  const rrContract = await rrFactory.deploy(mpContract.address);
  const rrReceipt = await rrContract.deployTransaction.wait();

  const rrMetadata = {
    contractName: "AgentReviewRegistry",
    networkName: config.networkName,
    chainId: String(config.chainId),
    rpcUrl: config.rpcUrl,
    address: rrContract.address,
    deployTransactionHash: rrContract.deployTransaction.hash,
    deployedBlockNumber: rrReceipt.blockNumber,
    deployer: wallet.address,
    constructorArgs: { marketplaceAddress: mpContract.address }
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
