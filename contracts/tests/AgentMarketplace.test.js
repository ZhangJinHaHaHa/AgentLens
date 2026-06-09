const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { ethers } = require("hardhat");

function loadArtifact(name) {
  const artifactPath = path.join(__dirname, "..", "artifacts", `${name}.json`);
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

async function deployMarketplace() {
  const [owner, operator, buyer1, buyer2] = await ethers.getSigners();
  const artifact = loadArtifact("AgentMarketplace");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner);
  const contract = await factory.deploy(operator.address);
  await contract.deployed();
  return { contract, owner, operator, buyer1, buyer2 };
}

describe("AgentMarketplace", function () {
  it("sets pricing and allows rental", async function () {
    const { contract, operator, buyer1 } = await deployMarketplace();

    await (await contract.connect(operator).setPrice(
      1,
      ethers.utils.parseEther("0.01"), // pricePerDay
      ethers.utils.parseEther("1")     // buyPrice
    )).wait();

    const pricing = await contract.getPricing(1);
    assert.strictEqual(pricing.configured, true);

    // Rent for 5 days
    await (await contract.connect(buyer1).rentAgent(1, 5, {
      value: ethers.utils.parseEther("0.05")
    })).wait();

    const hasAccess = await contract.hasAccess(1, buyer1.address);
    assert.strictEqual(hasAccess, true);

    const count = await contract.getAccessCount(1);
    assert.strictEqual(count.toNumber(), 1);

    const record = await contract.getAccessRecord(1, 0);
    assert.strictEqual(record.tokenId.toNumber(), 1);
    assert.strictEqual(record.buyer, buyer1.address);
    assert.strictEqual(record.isRental, true);
    assert.strictEqual(record.amountPaid.toString(), ethers.utils.parseEther("0.05").toString());
    assert.ok(record.expiresAt.toNumber() > 0);
  });

  it("allows permanent purchase", async function () {
    const { contract, operator, buyer1 } = await deployMarketplace();

    await (await contract.connect(operator).setPrice(
      1,
      ethers.utils.parseEther("0.01"),
      ethers.utils.parseEther("1")
    )).wait();

    await (await contract.connect(buyer1).buyAgent(1, {
      value: ethers.utils.parseEther("1")
    })).wait();

    const hasAccess = await contract.hasAccess(1, buyer1.address);
    assert.strictEqual(hasAccess, true);
  });

  it("rejects non-exact payment for rental", async function () {
    const { contract, operator, buyer1 } = await deployMarketplace();

    await (await contract.connect(operator).setPrice(
      1,
      ethers.utils.parseEther("0.01"),
      ethers.utils.parseEther("1")
    )).wait();

    try {
      await contract.connect(buyer1).rentAgent(1, 5, {
        value: ethers.utils.parseEther("0.01") // only pays for 1 day
      });
      assert.fail("Should revert");
    } catch (error) {
      assert.ok(error.message.includes("INVALID_PAYMENT"));
    }

    try {
      await contract.connect(buyer1).rentAgent(1, 5, {
        value: ethers.utils.parseEther("0.06")
      });
      assert.fail("Should revert");
    } catch (error) {
      assert.ok(error.message.includes("INVALID_PAYMENT"));
    }
  });

  it("allows owner to withdraw collected marketplace payments", async function () {
    const { contract, owner, operator, buyer1, buyer2 } = await deployMarketplace();

    await (await contract.connect(operator).setPrice(
      1,
      ethers.utils.parseEther("0.01"),
      ethers.utils.parseEther("1")
    )).wait();

    await (await contract.connect(buyer1).rentAgent(1, 5, {
      value: ethers.utils.parseEther("0.05")
    })).wait();

    const before = await ethers.provider.getBalance(buyer2.address);
    await (await contract.connect(owner).withdrawPayments(buyer2.address, ethers.utils.parseEther("0.05"))).wait();
    const after = await ethers.provider.getBalance(buyer2.address);

    assert.strictEqual(after.sub(before).toString(), ethers.utils.parseEther("0.05").toString());
  });

  it("prevents double purchase", async function () {
    const { contract, operator, buyer1 } = await deployMarketplace();

    await (await contract.connect(operator).setPrice(
      1,
      ethers.utils.parseEther("0.01"),
      ethers.utils.parseEther("1")
    )).wait();

    await (await contract.connect(buyer1).buyAgent(1, {
      value: ethers.utils.parseEther("1")
    })).wait();

    try {
      await contract.connect(buyer1).buyAgent(1, {
        value: ethers.utils.parseEther("1")
      });
      assert.fail("Should revert");
    } catch (error) {
      assert.ok(error.message.includes("ALREADY_PURCHASED"));
    }
  });

  it("hasAccess returns false for non-buyer", async function () {
    const { contract, buyer2 } = await deployMarketplace();

    const hasAccess = await contract.hasAccess(1, buyer2.address);
    assert.strictEqual(hasAccess, false);
  });
});
