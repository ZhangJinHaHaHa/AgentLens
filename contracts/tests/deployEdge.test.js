const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { ethers } = require("ethers");
const { readEdgeDeploymentConfig, deployEdgeRegistry } = require("../scripts/deployEdge");

describe("edge deployment", function () {
  it("requires the Polygon Edge deploy environment variables", function () {
    assert.throws(() => readEdgeDeploymentConfig({}), /EDGE_RPC_URL is required/);

    assert.throws(
      () =>
        readEdgeDeploymentConfig({
          EDGE_RPC_URL: "https://edge.example",
          EDGE_CHAIN_ID: "1001"
        }),
      /EDGE_DEPLOYER_PRIVATE_KEY is required/
    );

    assert.throws(
      () =>
        readEdgeDeploymentConfig({
          EDGE_RPC_URL: "https://edge.example",
          EDGE_CHAIN_ID: "1001",
          EDGE_DEPLOYER_PRIVATE_KEY: "0x1234"
        }),
      /EDGE_DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key/
    );

    assert.throws(
      () =>
        readEdgeDeploymentConfig({
          EDGE_RPC_URL: "https://edge.example",
          EDGE_CHAIN_ID: "1001.5",
          EDGE_DEPLOYER_PRIVATE_KEY: `0x${"1".repeat(64)}`
        }),
      /EDGE_CHAIN_ID must be a non-negative integer/
    );
  });

  it("writes Polygon Edge deployment metadata without requiring a live test chain in the unit test", async function () {
    const outputDir = path.join(__dirname, "..", "deployments", "polygon-edge-test");
    fs.rmSync(outputDir, { recursive: true, force: true });

    const config = readEdgeDeploymentConfig({
      EDGE_RPC_URL: "https://edge.example",
      EDGE_CHAIN_ID: "1001",
      EDGE_DEPLOYER_PRIVATE_KEY: `0x${"1".repeat(64)}`,
      EDGE_INITIAL_OPERATOR: "0x0000000000000000000000000000000000000abc"
    });

    const deployment = await deployEdgeRegistry(config, {
      outputDir,
      createProvider: () => ({
        getNetwork: async () => ({ chainId: 1001 })
      }),
      createWallet: () => ({
        address: "0x0000000000000000000000000000000000000def"
      }),
      createFactory: () => ({
        deploy: async (initialServiceFeeWei, initialMinimumBondWei, initialOperator) => {
          assert.equal(initialServiceFeeWei.toString(), "0");
          assert.equal(initialMinimumBondWei.toString(), "1");
          assert.equal(initialOperator, "0x0000000000000000000000000000000000000abc");

          return {
            address: "0x0000000000000000000000000000000000000fed",
            deployTransaction: {
              hash: `0x${"2".repeat(64)}`,
              wait: async () => ({ blockNumber: 42 })
            }
          };
        }
      })
    });

    const savedDeployment = JSON.parse(
      fs.readFileSync(path.join(outputDir, "AgentAuditRegistry.json"), "utf8")
    );

    assert.equal(deployment.networkName, "polygon-edge-test");
    assert.equal(savedDeployment.chainId, "1001");
    assert.equal(savedDeployment.address, "0x0000000000000000000000000000000000000fed");
    assert.equal(savedDeployment.deployer, "0x0000000000000000000000000000000000000def");
    assert.equal(
      savedDeployment.constructorArgs.initialOperator,
      "0x0000000000000000000000000000000000000abc"
    );
    assert.equal(savedDeployment.rpcUrl, "https://edge.example");
  });
});
