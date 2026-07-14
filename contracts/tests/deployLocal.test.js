const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { getHardhatConnection } = require("../scripts/hardhatConnection");
const { deployLocalRegistry } = require("../scripts/deployLocal");

let ethers;
before(async function () {
  ({ ethers } = await getHardhatConnection());
});

describe("local deployment", function () {
  it("deploys AgentAuditRegistry and writes deployment metadata", async function () {
    const deploymentPath = path.join(
      __dirname,
      "..",
      "deployments",
      "local",
      "AgentAuditRegistry.json"
    );

    fs.rmSync(path.dirname(deploymentPath), { recursive: true, force: true });

    const deployment = await deployLocalRegistry();
    const savedDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const code = await ethers.provider.getCode(savedDeployment.address);

    assert.strictEqual(deployment.contractName, "AgentAuditRegistry");
    assert.strictEqual(savedDeployment.contractName, "AgentAuditRegistry");
    assert.strictEqual(savedDeployment.networkName, "hardhat");
    assert.match(savedDeployment.address, /^0x[0-9a-f]{40}$/i);
    assert.match(savedDeployment.deployTransactionHash, /^0x[0-9a-f]{64}$/i);
    assert.ok(code.length > 2, "deployed address must contain contract bytecode");
  });
});
