const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { ethers } = require("hardhat");

function loadArtifact(name) {
  // Try flat path first (compileV2.js output), then Hardhat nested path
  const flatPath = path.join(__dirname, "..", "artifacts", `${name}.json`);
  if (fs.existsSync(flatPath)) {
    return JSON.parse(fs.readFileSync(flatPath, "utf8"));
  }
  const hardhatPath = path.join(__dirname, "..", "artifacts", "src", `${name}.sol`, `${name}.json`);
  return JSON.parse(fs.readFileSync(hardhatPath, "utf8"));
}

async function deployContracts() {
  const [owner, operator, reviewer1, reviewer2] = await ethers.getSigners();

  // Deploy marketplace first
  const mpArtifact = loadArtifact("AgentMarketplace");
  const mpFactory = new ethers.ContractFactory(mpArtifact.abi, mpArtifact.bytecode, owner);
  const marketplace = await mpFactory.deploy(operator.address);
  await marketplace.deployed();

  // Deploy review registry
  const rrArtifact = loadArtifact("AgentReviewRegistry");
  const rrFactory = new ethers.ContractFactory(rrArtifact.abi, rrArtifact.bytecode, owner);
  const reviewRegistry = await rrFactory.deploy(marketplace.address);
  await reviewRegistry.deployed();

  // Set pricing and grant access to reviewer1
  await (await marketplace.connect(operator).setPrice(
    1,
    ethers.utils.parseEther("0.01"),
    ethers.utils.parseEther("1")
  )).wait();

  await (await marketplace.connect(reviewer1).buyAgent(1, {
    value: ethers.utils.parseEther("1")
  })).wait();

  return { marketplace, reviewRegistry, owner, operator, reviewer1, reviewer2 };
}

// Rating constants: 0=Bad, 1=Neutral, 2=Good

describe("AgentReviewRegistry", function () {
  it("allows user with access to submit a review with 3-tier ratings", async function () {
    const { reviewRegistry, reviewer1 } = await deployContracts();

    const commentHash = ethers.utils.hexZeroPad("0xabcd", 32);
    // [good, neutral, bad, good, neutral, good]
    await (await reviewRegistry.connect(reviewer1).submitReview(
      1,
      [2, 1, 0, 2, 1, 2],
      commentHash
    )).wait();

    const count = await reviewRegistry.getReviewCount(1);
    assert.strictEqual(count.toNumber(), 1);

    const review = await reviewRegistry.getReview(1, 0);
    assert.strictEqual(review.reviewer, reviewer1.address);
    assert.strictEqual(review.securityRating, 2);       // good
    assert.strictEqual(review.taskExecutionRating, 1);   // neutral
    assert.strictEqual(review.cognitiveRating, 0);       // bad
  });

  it("rejects invalid rating values (> 2)", async function () {
    const { reviewRegistry, reviewer1 } = await deployContracts();

    try {
      await reviewRegistry.connect(reviewer1).submitReview(
        1,
        [2, 2, 3, 2, 2, 2],  // 3 is invalid
        ethers.utils.hexZeroPad("0x0", 32)
      );
      assert.fail("Should revert");
    } catch (error) {
      assert.ok(error.message.includes("INVALID_RATING"));
    }
  });

  it("prevents review without access", async function () {
    const { reviewRegistry, reviewer2 } = await deployContracts();

    try {
      await reviewRegistry.connect(reviewer2).submitReview(
        1,
        [2, 2, 2, 2, 2, 2],
        ethers.utils.hexZeroPad("0x0", 32)
      );
      assert.fail("Should revert");
    } catch (error) {
      assert.ok(error.message.includes("NO_ACCESS"));
    }
  });

  it("prevents duplicate reviews from same user", async function () {
    const { reviewRegistry, reviewer1 } = await deployContracts();

    await (await reviewRegistry.connect(reviewer1).submitReview(
      1,
      [2, 2, 2, 2, 2, 2],
      ethers.utils.hexZeroPad("0x0", 32)
    )).wait();

    try {
      await reviewRegistry.connect(reviewer1).submitReview(
        1,
        [0, 0, 0, 0, 0, 0],
        ethers.utils.hexZeroPad("0x0", 32)
      );
      assert.fail("Should revert");
    } catch (error) {
      assert.ok(error.message.includes("ALREADY_REVIEWED"));
    }
  });

  it("computes rating distribution correctly", async function () {
    const { marketplace, reviewRegistry, reviewer1, reviewer2 } = await deployContracts();

    // Grant access to reviewer2
    await (await marketplace.connect(reviewer2).buyAgent(1, {
      value: ethers.utils.parseEther("1")
    })).wait();

    // reviewer1: [good, good, bad, neutral, good, good]
    await (await reviewRegistry.connect(reviewer1).submitReview(
      1,
      [2, 2, 0, 1, 2, 2],
      ethers.utils.hexZeroPad("0x0", 32)
    )).wait();

    // reviewer2: [good, neutral, good, bad, neutral, good]
    await (await reviewRegistry.connect(reviewer2).submitReview(
      1,
      [2, 1, 2, 0, 1, 2],
      ethers.utils.hexZeroPad("0x0", 32)
    )).wait();

    const result = await reviewRegistry.getRatingDistribution(1);
    const goodRatios = result.goodRatios ?? result[0];
    const neutralRatios = result.neutralRatios ?? result[1];

    // security: 2 good / 2 = 10000
    assert.strictEqual(goodRatios[0], 10000);
    // taskExecution: 1 good / 2 = 5000, 1 neutral / 2 = 5000
    assert.strictEqual(goodRatios[1], 5000);
    assert.strictEqual(neutralRatios[1], 5000);
    // cognitive: 1 good / 2 = 5000
    assert.strictEqual(goodRatios[2], 5000);
    // compliance: 2 good / 2 = 10000
    assert.strictEqual(goodRatios[5], 10000);
  });
});
