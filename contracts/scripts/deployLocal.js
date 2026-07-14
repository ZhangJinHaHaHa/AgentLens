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
