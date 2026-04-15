const fs = require("fs");
const path = require("path");

const hre = require("hardhat");

const ARTIFACT_PATH = path.join(__dirname, "..", "artifacts", "AgentAuditRegistry.json");
const DEFAULT_DEPLOYMENT_DIR = path.join(__dirname, "..", "deployments", "local");
const DEFAULT_SERVICE_FEE_WEI = hre.ethers.utils.parseEther("0.01");
const DEFAULT_MINIMUM_BOND_WEI = hre.ethers.utils.parseEther("1");

function loadArtifact() {
  return JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
}

async function deployLocalRegistry(options = {}) {
  const outputDir = options.outputDir ?? DEFAULT_DEPLOYMENT_DIR;
  const [deployer, operator] = await hre.ethers.getSigners();
  const artifact = loadArtifact();
  const factory = new hre.ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);

  const contract = await factory.deploy(
    DEFAULT_SERVICE_FEE_WEI,
    DEFAULT_MINIMUM_BOND_WEI,
    operator.address
  );
  const receipt = await contract.deployTransaction.wait();
  const network = await hre.ethers.provider.getNetwork();

  const deployment = {
    contractName: "AgentAuditRegistry",
    networkName: hre.network.name,
    chainId: String(network.chainId),
    address: contract.address,
    deployTransactionHash: contract.deployTransaction.hash,
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
