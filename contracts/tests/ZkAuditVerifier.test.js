const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { ethers } = require("hardhat");

function loadArtifact(name) {
  const flatPath = path.join(__dirname, "..", "artifacts", `${name}.json`);
  if (fs.existsSync(flatPath)) {
    return JSON.parse(fs.readFileSync(flatPath, "utf8"));
  }
  const hardhatPath = path.join(__dirname, "..", "artifacts", "src", `${name}.sol`, `${name}.json`);
  return JSON.parse(fs.readFileSync(hardhatPath, "utf8"));
}

const PROOF_A = [1, 2];
const PROOF_B = [
  [3, 4],
  [5, 6]
];
const PROOF_C = [7, 8];

const DIMENSIONAL_SCORES = [80, 85, 90, 75, 88, 92];
const OVERALL_SCORE = 85;
const INPUT_COMMITMENT = 12345;

async function deployZkAuditVerifier() {
  const [owner] = await ethers.getSigners();

  const mockArtifact = loadArtifact("MockGroth16Verifier");
  const mockFactory = new ethers.ContractFactory(mockArtifact.abi, mockArtifact.bytecode, owner);
  const mockVerifier = await mockFactory.deploy();
  await mockVerifier.deployed();

  const verifierArtifact = loadArtifact("ZkAuditVerifier");
  const verifierFactory = new ethers.ContractFactory(verifierArtifact.abi, verifierArtifact.bytecode, owner);
  const verifier = await verifierFactory.deploy();
  await verifier.deployed();

  await (await verifier.setAuditScoreVerifier(mockVerifier.address)).wait();
  await (await verifier.setFingerprintVerifier(mockVerifier.address)).wait();

  return { verifier, owner };
}

function buildAuditScoreArgs(tokenId, auditId) {
  return [
    tokenId,
    auditId,
    DIMENSIONAL_SCORES,
    OVERALL_SCORE,
    INPUT_COMMITMENT,
    PROOF_A,
    PROOF_B,
    PROOF_C
  ];
}

function buildFingerprintArgs(tokenId, fingerprintHash, developerHash) {
  return [tokenId, fingerprintHash, developerHash, PROOF_A, PROOF_B, PROOF_C];
}

describe("ZkAuditVerifier — proof replay protection", function () {
  it("verifyAuditScore stores the first proof and increments auditProofCount", async function () {
    const { verifier } = await deployZkAuditVerifier();

    await (await verifier.verifyAuditScore(...buildAuditScoreArgs(1, 1))).wait();

    assert.strictEqual(await verifier.isAuditScoreVerified(1, 1), true);
    assert.strictEqual((await verifier.auditProofCount(1)).toNumber(), 1);

    const stored = await verifier.getAuditScoreProof(1, 1);
    assert.strictEqual(stored.overallScore.toNumber(), OVERALL_SCORE);
    assert.strictEqual(stored.verified, true);
  });

  it("rejects replaying the same audit score proof for the same tokenId and auditId", async function () {
    const { verifier } = await deployZkAuditVerifier();

    await (await verifier.verifyAuditScore(...buildAuditScoreArgs(1, 1))).wait();

    await assert.rejects(
      verifier.verifyAuditScore(...buildAuditScoreArgs(1, 1)),
      /PROOF_REPLAYED/
    );

    assert.strictEqual((await verifier.auditProofCount(1)).toNumber(), 1);
  });

  it("rejects replaying the same audit score proof for a different tokenId and auditId", async function () {
    const { verifier } = await deployZkAuditVerifier();

    await (await verifier.verifyAuditScore(...buildAuditScoreArgs(1, 1))).wait();

    await assert.rejects(
      verifier.verifyAuditScore(...buildAuditScoreArgs(2, 2)),
      /PROOF_REPLAYED/
    );

    assert.strictEqual(await verifier.isAuditScoreVerified(2, 2), false);
    assert.strictEqual((await verifier.auditProofCount(2)).toNumber(), 0);
  });

  it("rejects replaying the same fingerprint proof", async function () {
    const { verifier } = await deployZkAuditVerifier();

    await (await verifier.verifyFingerprint(...buildFingerprintArgs(1, 111, 222))).wait();
    assert.strictEqual(await verifier.isFingerprintVerified(1), true);

    await assert.rejects(
      verifier.verifyFingerprint(...buildFingerprintArgs(1, 111, 222)),
      /PROOF_REPLAYED/
    );

    await assert.rejects(
      verifier.verifyFingerprint(...buildFingerprintArgs(2, 333, 444)),
      /PROOF_REPLAYED/
    );

    assert.strictEqual(await verifier.isFingerprintVerified(2), false);
  });
});
