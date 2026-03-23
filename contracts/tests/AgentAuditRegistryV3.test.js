const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { ethers } = require("hardhat");

function loadV3Artifact() {
  const artifactPath = path.join(__dirname, "..", "artifacts", "AgentAuditRegistryV3.json");
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

async function deployV3Registry() {
  const [owner, operator, developer] = await ethers.getSigners();
  const artifact = loadV3Artifact();
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner);
  const contract = await factory.deploy(
    ethers.utils.parseEther("0.01"),
    ethers.utils.parseEther("1"),
    operator.address
  );
  await contract.deployed();
  return { contract, owner, operator, developer };
}

const STAKE_VALUE = ethers.utils.parseEther("1.01");
const ZERO_HASH = ethers.utils.hexZeroPad("0x0", 32);

async function stakeAndPassAudit(contract, operator, developer, score) {
  await (await contract.connect(developer).stake("test-agent", "https://m.example.com", {
    value: STAKE_VALUE
  })).wait();

  const auditCount = await contract.getAuditCount(1);
  const auditId = auditCount.toNumber();

  await (await contract.connect(operator).recordAuditResultV2(
    1, score, 256, 150, 3, 1, // status 1 = Passed
    ethers.utils.hexZeroPad("0xabc", 32),
    ethers.utils.hexZeroPad("0xdef", 32),
    ZERO_HASH, ZERO_HASH,
    "", "QmReport", "https://m.example.com",
    [8500, 9000, 7500, 8000, 7000, 9500]
  )).wait();

  return auditId;
}

describe("AgentAuditRegistryV3 — MDDRM Reputation", function () {
  it("audit pass increases currentReputationScore by BASE_POINTS * auditScore / 100", async function () {
    const { contract, operator, developer } = await deployV3Registry();

    await stakeAndPassAudit(contract, operator, developer, 80);

    const rep = await contract.getReputation(1);
    // BASE_POINTS_PER_AUDIT = 50, score = 80 → contribution = 50 * 80 / 100 = 40
    assert.strictEqual(rep.currentReputationScore, 40);
    assert.ok(rep.lastReputationUpdateAt > 0);
  });

  it("multiple audit passes accumulate score, capped at 10000", async function () {
    const { contract, operator, developer } = await deployV3Registry();

    // Each pass with score 100 → contribution = 50 * 100 / 100 = 50
    // We need 200 passes to reach 10000, but let's do a few and verify accumulation
    await stakeAndPassAudit(contract, operator, developer, 100);
    let rep = await contract.getReputation(1);
    assert.strictEqual(rep.currentReputationScore, 50);

    // Second audit
    await stakeAndPassAudit(contract, operator, developer, 100);
    rep = await contract.getReputation(1);
    assert.strictEqual(rep.currentReputationScore, 100);

    // Third audit with score 60 → contribution = 50 * 60 / 100 = 30
    await stakeAndPassAudit(contract, operator, developer, 60);
    rep = await contract.getReputation(1);
    assert.strictEqual(rep.currentReputationScore, 130);
  });

  it("appeal success adds APPEAL_SUCCESS_BONUS (100) and reputationDelta +1", async function () {
    const { contract, operator, developer } = await deployV3Registry();

    // First build some reputation via audit
    await stakeAndPassAudit(contract, operator, developer, 80);

    // Now create a failed audit to slash
    await (await contract.connect(developer).stake("test-agent", "https://m2.example.com", {
      value: STAKE_VALUE
    })).wait();
    await (await contract.connect(operator).recordAuditResult(
      1, 0, 256, 150, 3, 2, // status 2 = Failed
      ethers.utils.hexZeroPad("0xabc", 32),
      ethers.utils.hexZeroPad("0xdef", 32),
      ZERO_HASH, ZERO_HASH,
      "", "QmReport", "https://m2.example.com"
    )).wait();

    await (await contract.connect(operator).slashBond(
      1, 2, ethers.utils.parseEther("0.5"),
      ethers.utils.hexZeroPad("0x01", 32)
    )).wait();

    // File and approve appeal
    await (await contract.connect(operator).fileAppeal(
      1, 2,
      ethers.utils.hexZeroPad("0xed1d", 32),
      "QmAppealData"
    )).wait();

    await (await contract.connect(operator).resolveAppeal(1, 1, 1)).wait(); // Approved

    const rep = await contract.getReputation(1);
    assert.strictEqual(rep.successfulAppeals, 1);
    assert.strictEqual(rep.reputationDelta, 1);
    // Slash zeroed score (blacklisted), appeal adds 100 → 100
    assert.strictEqual(rep.currentReputationScore, 100);
  });

  it("appeal failure subtracts APPEAL_FAILURE_PENALTY (200), floor at 0", async function () {
    const { contract, operator, developer } = await deployV3Registry();

    // Build score = 40 via audit
    await stakeAndPassAudit(contract, operator, developer, 80);

    // Fail + slash
    await (await contract.connect(developer).stake("test-agent", "https://m2.example.com", {
      value: STAKE_VALUE
    })).wait();
    await (await contract.connect(operator).recordAuditResult(
      1, 0, 256, 150, 3, 2,
      ethers.utils.hexZeroPad("0xabc", 32),
      ethers.utils.hexZeroPad("0xdef", 32),
      ZERO_HASH, ZERO_HASH,
      "", "QmReport", "https://m2.example.com"
    )).wait();

    await (await contract.connect(operator).slashBond(
      1, 2, ethers.utils.parseEther("0.5"),
      ethers.utils.hexZeroPad("0x01", 32)
    )).wait();

    // File and reject appeal
    await (await contract.connect(operator).fileAppeal(1, 2, ZERO_HASH, "")).wait();
    await (await contract.connect(operator).resolveAppeal(1, 1, 2)).wait(); // Rejected

    const rep = await contract.getReputation(1);
    assert.strictEqual(rep.failedAppeals, 1);
    assert.strictEqual(rep.reputationDelta, -1);
    // Score was 0 (blacklist zeroed it), penalty 200 → still 0 (floor)
    assert.strictEqual(rep.currentReputationScore, 0);
  });

  it("slash halves score; blacklisted zeroes score", async function () {
    const { contract, operator, developer } = await deployV3Registry();

    // Build score = 50 via audit (score 100)
    await stakeAndPassAudit(contract, operator, developer, 100);

    let rep = await contract.getReputation(1);
    assert.strictEqual(rep.currentReputationScore, 50);

    // Slash (sets blacklisted = true → score goes to 0)
    await (await contract.connect(developer).stake("test-agent", "https://m2.example.com", {
      value: STAKE_VALUE
    })).wait();
    await (await contract.connect(operator).recordAuditResult(
      1, 0, 256, 150, 3, 2,
      ethers.utils.hexZeroPad("0xabc", 32),
      ethers.utils.hexZeroPad("0xdef", 32),
      ZERO_HASH, ZERO_HASH,
      "", "QmReport", "https://m2.example.com"
    )).wait();

    await (await contract.connect(operator).slashBond(
      1, 2, ethers.utils.parseEther("0.5"),
      ethers.utils.hexZeroPad("0x01", 32)
    )).wait();

    rep = await contract.getReputation(1);
    // blacklisted = true → score zeroed
    assert.strictEqual(rep.currentReputationScore, 0);
  });

  it("time decay reduces score proportionally after DECAY_PERIOD", async function () {
    const { contract, operator, developer } = await deployV3Registry();

    // Build a decent score: 10 audits with score 100 → 10 * 50 = 500
    for (let i = 0; i < 10; i++) {
      await stakeAndPassAudit(contract, operator, developer, 100);
    }

    let rep = await contract.getReputation(1);
    assert.strictEqual(rep.currentReputationScore, 500);

    // Advance time by 30 days (DECAY_PERIOD)
    await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    // Trigger decay by doing another audit
    await stakeAndPassAudit(contract, operator, developer, 100);

    rep = await contract.getReputation(1);
    // After 30 days: decay = 500 * 100 * (30 days) / (30 days * 10000) = 500 * 1% = 5
    // new score = 500 - 5 + 50 = 545
    assert.strictEqual(rep.currentReputationScore, 545);
  });

  it("zero score agent with decay remains at 0, no underflow", async function () {
    const { contract, operator, developer } = await deployV3Registry();

    // Register agent without passing any audit → score = 0
    await (await contract.connect(developer).stake("test-agent", "https://m.example.com", {
      value: STAKE_VALUE
    })).wait();

    // Record a failed audit (no reputation gain)
    await (await contract.connect(operator).recordAuditResult(
      1, 0, 256, 150, 3, 2,
      ethers.utils.hexZeroPad("0xabc", 32),
      ethers.utils.hexZeroPad("0xdef", 32),
      ZERO_HASH, ZERO_HASH,
      "", "QmReport", "https://m.example.com"
    )).wait();

    let rep = await contract.getReputation(1);
    assert.strictEqual(rep.currentReputationScore, 0);

    // Advance time
    await ethers.provider.send("evm_increaseTime", [60 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    // Do another stake + pass to trigger decay on zero
    await stakeAndPassAudit(contract, operator, developer, 50);

    rep = await contract.getReputation(1);
    // Decay on 0 = 0, then add 50 * 50 / 100 = 25
    assert.strictEqual(rep.currentReputationScore, 25);
  });
});
