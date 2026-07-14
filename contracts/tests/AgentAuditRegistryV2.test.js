const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { getHardhatConnection } = require("../scripts/hardhatConnection");

let ethers;
let STAKE_VALUE;
let ZERO_HASH;
before(async function () {
  ({ ethers } = await getHardhatConnection());
  STAKE_VALUE = ethers.parseEther("1.01");
  ZERO_HASH = pad32("0x0");
});

function pad32(value) {
  return ethers.toBeHex(BigInt(value), 32);
}

function loadV2Artifact() {
  const artifactPath = path.join(__dirname, "..", "artifacts", "AgentAuditRegistryV2.json");
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

async function deployV2Registry() {
  const [owner, operator, developer] = await ethers.getSigners();
  const artifact = loadV2Artifact();
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner);
  const contract = await factory.deploy(
    ethers.parseEther("0.01"),
    ethers.parseEther("1"),
    operator.address
  );
  await contract.waitForDeployment();
  return { contract, owner, operator, developer };
}

describe("AgentAuditRegistryV2", function () {
  it("stakes and creates a pending audit with zero dimensional scores", async function () {
    const { contract, developer } = await deployV2Registry();

    await (await contract.connect(developer).stake("test-agent", "https://m.example.com", {
      value: STAKE_VALUE
    })).wait();

    const profile = await contract.getAgentProfile(1);
    assert.strictEqual(profile.agentName, "test-agent");

    const latest = await contract.getLatestAuditReport(1);
    assert.strictEqual(Number(latest.status), 0); // Pending
    assert.strictEqual(Number(latest.dimensionalScores.security), 0);
  });

  it("records audit result with dimensional scores via recordAuditResultV2", async function () {
    const { contract, operator, developer } = await deployV2Registry();

    await (await contract.connect(developer).stake("test-agent", "https://m.example.com", {
      value: STAKE_VALUE
    })).wait();

    const scores = [8500, 9000, 7500, 8000, 7000, 9500];

    await (await contract.connect(operator).recordAuditResultV2(
      1, 91, 256, 150, 3, 1,
      pad32("0xabc"),
      pad32("0xdef"),
      ZERO_HASH, ZERO_HASH,
      "", "QmReport", "https://m.example.com",
      scores
    )).wait();

    const dimScores = await contract.getDimensionalScores(1, 0);
    assert.strictEqual(Number(dimScores.security), 8500);
    assert.strictEqual(Number(dimScores.taskExecution), 9000);
    assert.strictEqual(Number(dimScores.compliance), 9500);
  });

  it("getAverageScores returns averages across scored audits", async function () {
    const { contract, operator, developer } = await deployV2Registry();

    await (await contract.connect(developer).stake("test-agent", "https://m1.example.com", {
      value: STAKE_VALUE
    })).wait();

    await (await contract.connect(operator).recordAuditResultV2(
      1, 80, 256, 150, 3, 1,
      pad32("0xabc"),
      pad32("0xdef"),
      ZERO_HASH, ZERO_HASH,
      "", "Qm1", "https://m1.example.com",
      [8000, 7000, 6000, 5000, 4000, 3000]
    )).wait();

    await (await contract.connect(developer).stake("test-agent", "https://m2.example.com", {
      value: STAKE_VALUE
    })).wait();

    await (await contract.connect(operator).recordAuditResultV2(
      1, 90, 128, 100, 2, 1,
      pad32("0xabc"),
      pad32("0xdef"),
      ZERO_HASH, ZERO_HASH,
      "", "Qm2", "https://m2.example.com",
      [6000, 9000, 8000, 7000, 6000, 5000]
    )).wait();

    const avg = await contract.getAverageScores(1);
    assert.strictEqual(Number(avg.security), 7000);
    assert.strictEqual(Number(avg.taskExecution), 8000);
  });

  it("files and resolves appeal with reputation tracking (approved)", async function () {
    const { contract, operator, developer } = await deployV2Registry();

    await (await contract.connect(developer).stake("test-agent", "https://m.example.com", {
      value: STAKE_VALUE
    })).wait();

    await (await contract.connect(operator).recordAuditResult(
      1, 0, 256, 150, 3, 2,
      pad32("0xabc"),
      pad32("0xdef"),
      ZERO_HASH, ZERO_HASH,
      "", "QmReport", "https://m.example.com"
    )).wait();

    await (await contract.connect(operator).slashBond(
      1, 1, ethers.parseEther("0.5"),
      pad32("0x01")
    )).wait();

    await (await contract.connect(operator).fileAppeal(
      1, 1,
      pad32("0xed1d"),
      "QmAppealData"
    )).wait();

    const appeal = await contract.getAppealRecord(1, 1);
    assert.strictEqual(Number(appeal.outcome), 0); // Pending
    assert.strictEqual(appeal.appealCID, "QmAppealData");

    // Resolve as approved
    await (await contract.connect(operator).resolveAppeal(1, 1, 1)).wait();

    const resolved = await contract.getAppealRecord(1, 1);
    assert.strictEqual(Number(resolved.outcome), 1); // Approved

    const rep = await contract.getReputation(1);
    assert.strictEqual(Number(rep.successfulAppeals), 1);
    assert.strictEqual(Number(rep.reputationDelta), 1);

    // Audit should be auto-compensated
    const audit = await contract.getAuditReportByIndex(1, 0);
    assert.strictEqual(Number(audit.status), 4); // Compensated
    assert.strictEqual(audit.appealApproved, true);
  });

  it("rejected appeal decreases reputation", async function () {
    const { contract, operator, developer } = await deployV2Registry();

    await (await contract.connect(developer).stake("test-agent", "https://m.example.com", {
      value: STAKE_VALUE
    })).wait();

    await (await contract.connect(operator).recordAuditResult(
      1, 0, 256, 150, 3, 2,
      pad32("0xabc"),
      pad32("0xdef"),
      ZERO_HASH, ZERO_HASH,
      "", "QmReport", "https://m.example.com"
    )).wait();

    await (await contract.connect(operator).slashBond(
      1, 1, ethers.parseEther("0.5"),
      pad32("0x01")
    )).wait();

    await (await contract.connect(operator).fileAppeal(1, 1, ZERO_HASH, "")).wait();
    await (await contract.connect(operator).resolveAppeal(1, 1, 2)).wait(); // Rejected

    const rep = await contract.getReputation(1);
    assert.strictEqual(Number(rep.failedAppeals), 1);
    assert.strictEqual(Number(rep.reputationDelta), -1);
  });

  it("cannot resolve appeal twice", async function () {
    const { contract, operator, developer } = await deployV2Registry();

    await (await contract.connect(developer).stake("test-agent", "https://m.example.com", {
      value: STAKE_VALUE
    })).wait();

    await (await contract.connect(operator).recordAuditResult(
      1, 0, 256, 150, 3, 2,
      pad32("0xabc"),
      pad32("0xdef"),
      ZERO_HASH, ZERO_HASH,
      "", "QmReport", "https://m.example.com"
    )).wait();

    await (await contract.connect(operator).slashBond(
      1, 1, ethers.parseEther("0.5"),
      pad32("0x01")
    )).wait();

    await (await contract.connect(operator).fileAppeal(1, 1, ZERO_HASH, "")).wait();
    await (await contract.connect(operator).resolveAppeal(1, 1, 1)).wait();

    try {
      await contract.connect(operator).resolveAppeal(1, 1, 2);
      assert.fail("Should have reverted");
    } catch (error) {
      assert.ok(error.message.includes("APPEAL_ALREADY_RESOLVED"), error.message);
    }
  });
});
