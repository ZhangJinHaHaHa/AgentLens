const { ethers, utils } = require("ethers");

function parseRequiredInteger(value, variableName) {
  if (!value) {
    throw new Error(`${variableName} is required`);
  }

  if (!/^\d+$/u.test(value)) {
    throw new Error(`${variableName} must be a non-negative integer`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${variableName} must be a safe integer`);
  }

  return parsed;
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
    return "";
  }

  if (!utils.isAddress(value)) {
    throw new Error(`${variableName} must be a valid EVM address`);
  }

  return value;
}

function parseWeiString(value, variableName, fallbackValue) {
  const rawValue = value || fallbackValue;

  if (!/^\d+$/u.test(rawValue)) {
    throw new Error(`${variableName} must be a non-negative integer string in wei`);
  }

  return ethers.BigNumber.from(rawValue).toString();
}

function readRegistryDeploymentConfig(env, options = {}) {
  const rpcUrl = env.EDGE_RPC_URL;
  if (!rpcUrl) {
    throw new Error("EDGE_RPC_URL is required");
  }

  return {
    rpcUrl,
    chainId: parseRequiredInteger(env.EDGE_CHAIN_ID, "EDGE_CHAIN_ID"),
    deployerPrivateKey: parseRequiredPrivateKey(
      env.EDGE_DEPLOYER_PRIVATE_KEY,
      "EDGE_DEPLOYER_PRIVATE_KEY"
    ),
    networkName: env.EDGE_NETWORK_NAME || options.defaultNetworkName || "polygon-edge-test",
    initialOperator: parseOptionalAddress(env.EDGE_INITIAL_OPERATOR, "EDGE_INITIAL_OPERATOR"),
    serviceFeeWei: parseWeiString(
      env.EDGE_INITIAL_SERVICE_FEE_WEI,
      "EDGE_INITIAL_SERVICE_FEE_WEI",
      options.defaultServiceFeeWei || "0"
    ),
    minimumBondWei: parseWeiString(
      env.EDGE_INITIAL_MINIMUM_BOND_WEI,
      "EDGE_INITIAL_MINIMUM_BOND_WEI",
      options.defaultMinimumBondWei || "1"
    )
  };
}

module.exports = {
  parseOptionalAddress,
  parseRequiredInteger,
  parseRequiredPrivateKey,
  parseWeiString,
  readRegistryDeploymentConfig
};
