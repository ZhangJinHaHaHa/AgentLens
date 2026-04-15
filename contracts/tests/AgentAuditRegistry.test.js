const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { ethers } = require("hardhat");

function numericString(value) {
  return value.toString();
}

function loadArtifact() {
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "AgentAuditRegistry.json"
  );

  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

async function deployRegistry() {
  const [owner, operator] = await ethers.getSigners();
  const artifact = loadArtifact();
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner);
  const contract = await factory.deploy(
    ethers.utils.parseEther("0.01"),
    ethers.utils.parseEther("1"),
    operator.address
  );

  await contract.deployed();

  return { contract, owner, operator };
}

describe("AgentAuditRegistry", function () {
  it("stakes once per identity and opens a pending audit", async function () {
    const { contract, owner } = await deployRegistry();
    const totalValue = ethers.utils.parseEther("1.01");

    await contract.stake("demo-agent", "ipfs://manifest-1", { value: totalValue });

    const tokenId = await contract.getTokenId(owner.address, "demo-agent");
    const profile = await contract.getAgentProfile(tokenId);
    const latestReport = await contract.getLatestAuditReport(tokenId);
    const auditCount = await contract.getAuditCount(tokenId);

    assert.strictEqual(tokenId.toString(), "1");
    assert.strictEqual(numericString(profile.auditCount), "0");
    assert.strictEqual(profile.totalBond.toString(), ethers.utils.parseEther("1").toString());
    assert.strictEqual(auditCount.toString(), "1");
    assert.strictEqual(numericString(latestReport.auditId), "1");
    assert.strictEqual(numericString(latestReport.status), "0");
    assert.strictEqual(latestReport.manifestUrl, "ipfs://manifest-1");
  });

  it("records the latest pending audit and increments profile stats", async function () {
    const { contract, owner, operator } = await deployRegistry();

    await contract.stake("demo-agent", "ipfs://manifest-1", {
      value: ethers.utils.parseEther("1.01")
    });

    const tokenId = await contract.getTokenId(owner.address, "demo-agent");

    await contract
      .connect(operator)
      .recordAuditResult(
        tokenId,
        91,
        512,
        320,
        3,
        1,
        ethers.utils.formatBytes32String("manifest"),
        ethers.utils.formatBytes32String("report"),
        ethers.utils.formatBytes32String("evidence"),
        ethers.utils.formatBytes32String("attest"),
        "ipfs://evidence-1",
        "ipfs://report-1",
        "ipfs://manifest-1"
      );

    const profile = await contract.getAgentProfile(tokenId);
    const latestReport = await contract.getLatestAuditReport(tokenId);

    assert.strictEqual(numericString(profile.auditCount), "1");
    assert.ok(profile.lastAuditAt.gt(0));
    assert.strictEqual(numericString(latestReport.auditScore), "91");
    assert.strictEqual(numericString(latestReport.status), "1");
    assert.strictEqual(latestReport.evidenceCID, "ipfs://evidence-1");
    assert.strictEqual(latestReport.reportCID, "ipfs://report-1");
  });

  it("slashes bond and blacklists the agent", async function () {
    const { contract, owner, operator } = await deployRegistry();

    await contract.stake("demo-agent", "ipfs://manifest-1", {
      value: ethers.utils.parseEther("1.01")
    });

    const tokenId = await contract.getTokenId(owner.address, "demo-agent");

    await contract
      .connect(operator)
      .slashBond(tokenId, 1, ethers.utils.parseEther("0.4"), ethers.constants.HashZero);

    const profile = await contract.getAgentProfile(tokenId);
    const latestReport = await contract.getLatestAuditReport(tokenId);

    assert.strictEqual(profile.blacklisted, true);
    assert.strictEqual(profile.totalBond.toString(), ethers.utils.parseEther("0.6").toString());
    assert.strictEqual(numericString(latestReport.status), "3");
  });

  it("compensates bond only after slashing", async function () {
    const { contract, owner, operator } = await deployRegistry();

    await contract.stake("demo-agent", "ipfs://manifest-1", {
      value: ethers.utils.parseEther("1.01")
    });

    const tokenId = await contract.getTokenId(owner.address, "demo-agent");

    await assert.rejects(
      contract
        .connect(operator)
        .compensateBond(tokenId, 1, ethers.utils.parseEther("0.2"), ethers.constants.HashZero),
      /AUDIT_NOT_SLASHED/
    );

    await contract
      .connect(operator)
      .slashBond(tokenId, 1, ethers.utils.parseEther("0.4"), ethers.constants.HashZero);

    await contract
      .connect(operator)
      .compensateBond(tokenId, 1, ethers.utils.parseEther("0.4"), ethers.constants.HashZero);

    const profile = await contract.getAgentProfile(tokenId);
    const latestReport = await contract.getLatestAuditReport(tokenId);

    assert.strictEqual(profile.totalBond.toString(), ethers.utils.parseEther("1").toString());
    assert.strictEqual(numericString(latestReport.status), "4");
    assert.strictEqual(latestReport.appealApproved, true);
  });
});
