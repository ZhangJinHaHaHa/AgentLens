const { ethers } = require("ethers");

function createStaticJsonRpcProvider(config) {
  return new ethers.JsonRpcProvider(
    config.rpcUrl,
    { chainId: config.chainId, name: config.networkName },
    { staticNetwork: true }
  );
}

async function waitForDeploymentMetadata(contract) {
  if (typeof contract.waitForDeployment === "function") {
    await contract.waitForDeployment();
  }
  const transaction = typeof contract.deploymentTransaction === "function"
    ? contract.deploymentTransaction()
    : contract.deployTransaction;
  if (!transaction || typeof transaction.wait !== "function") {
    throw new Error("Contract deployment transaction is unavailable.");
  }
  const receipt = await transaction.wait();
  const address = typeof contract.getAddress === "function"
    ? await contract.getAddress()
    : contract.address;
  if (!address || !transaction.hash || !receipt) {
    throw new Error("Contract deployment metadata is incomplete.");
  }
  return { address, transactionHash: transaction.hash, receipt };
}

module.exports = { createStaticJsonRpcProvider, waitForDeploymentMetadata };
