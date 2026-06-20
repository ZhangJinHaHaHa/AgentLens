const assert = require("assert");

const { readRegistryDeploymentConfig } = require("../scripts/deployConfig");
const { readMarketplaceDeploymentConfig } = require("../scripts/deployMarketplace");
const { readV2DeploymentConfig } = require("../scripts/deployV2");
const { readV3DeploymentConfig } = require("../scripts/deployV3");

const validEnv = {
  EDGE_RPC_URL: "https://edge.example",
  EDGE_CHAIN_ID: "1001",
  EDGE_DEPLOYER_PRIVATE_KEY: `0x${"1".repeat(64)}`,
  EDGE_INITIAL_OPERATOR: "0x0000000000000000000000000000000000000abc",
  EDGE_INITIAL_SERVICE_FEE_WEI: "0",
  EDGE_INITIAL_MINIMUM_BOND_WEI: "1"
};

describe("registry deployment config", function () {
  it("validates common deployment config for V2, V3, and marketplace scripts", function () {
    for (const readConfig of [
      readRegistryDeploymentConfig,
      readV2DeploymentConfig,
      readV3DeploymentConfig,
      readMarketplaceDeploymentConfig
    ]) {
      const config = readConfig(validEnv);
      assert.equal(config.rpcUrl, "https://edge.example");
      assert.equal(config.chainId, 1001);
      assert.equal(config.deployerPrivateKey, validEnv.EDGE_DEPLOYER_PRIVATE_KEY);
      assert.equal(config.networkName, "polygon-edge-test");
      assert.equal(config.initialOperator, validEnv.EDGE_INITIAL_OPERATOR);
    }
  });

  it("rejects malformed chain ids, private keys, operator addresses, and wei values", function () {
    assert.throws(
      () => readRegistryDeploymentConfig({ ...validEnv, EDGE_CHAIN_ID: "1001.5" }),
      /EDGE_CHAIN_ID must be a non-negative integer/
    );
    assert.throws(
      () => readRegistryDeploymentConfig({ ...validEnv, EDGE_DEPLOYER_PRIVATE_KEY: "0x1234" }),
      /EDGE_DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key/
    );
    assert.throws(
      () => readRegistryDeploymentConfig({ ...validEnv, EDGE_INITIAL_OPERATOR: "0x1234" }),
      /EDGE_INITIAL_OPERATOR must be a valid EVM address/
    );
    assert.throws(
      () => readRegistryDeploymentConfig({ ...validEnv, EDGE_INITIAL_SERVICE_FEE_WEI: "1.5" }),
      /EDGE_INITIAL_SERVICE_FEE_WEI must be a non-negative integer string in wei/
    );
  });
});
