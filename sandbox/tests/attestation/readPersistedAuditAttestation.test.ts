import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildAuditAttestationArtifact } from "../../src/attestation/buildAuditAttestation";
import { persistAuditAttestation } from "../../src/attestation/persistAuditAttestation";
import { readPersistedAuditAttestation } from "../../src/attestation/readPersistedAuditAttestation";
import {
  buildMockSgxDcapQuote,
  computeExpectedReportData
} from "../../src/attestation/sgxDcapQuoteValidator";

async function writeValidArtifact(baseDir: string, eventKey = "0xabc:0") {
  const artifact = buildAuditAttestationArtifact({
    schemaVersion: "audit-attestation.v1",
    eventKey,
    tokenId: "1",
    manifestHash: "a".repeat(64),
    evidenceRoot: "e".repeat(64),
    verifier: {
      type: "mock-tee",
      measurement: "m".repeat(64),
      quoteFormat: "mock-quote",
      sessionPublicKey: "spk-123",
      quote: "quote-abc"
    }
  });

  return persistAuditAttestation({
    eventKey,
    tokenId: 1n,
    attestationArtifact: artifact,
    baseDir
  });
}

test("readPersistedAuditAttestation verifies a persisted attestation bundle", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "audit-attestation-read-"));
  const persisted = await writeValidArtifact(baseDir);

  const result = await readPersistedAuditAttestation({
    eventKey: "0xabc:0",
    baseDir
  });

  assert.deepEqual(result, {
    status: "verified",
    eventKey: "0xabc:0",
    attestationFilePath: persisted.attestationFilePath,
    attestationHash: persisted.attestationHash
  });
});

test("readPersistedAuditAttestation verifies expected verifier metadata when provided", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "audit-attestation-read-"));
  await writeValidArtifact(baseDir, "0xabc:2");

  const result = await readPersistedAuditAttestation({
    eventKey: "0xabc:2",
    baseDir,
    expectedVerifier: {
      providerType: "mock-tee",
      measurement: "m".repeat(64),
      quoteFormat: "mock-quote"
    }
  });

  assert.equal(result.status, "verified");
});

test("readPersistedAuditAttestation returns hash_mismatch when persisted bytes are tampered", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "audit-attestation-read-"));
  const persisted = await writeValidArtifact(baseDir, "0xabc:7");
  await writeFile(
    persisted.attestationFilePath,
    JSON.stringify({
      schemaVersion: "audit-attestation.v1",
      eventKey: "0xabc:7",
      tokenId: "1",
      manifestHash: "a".repeat(64),
      evidenceRoot: "e".repeat(64),
      verifier: {
        type: "mock-tee",
        measurement: "",
        quoteFormat: "mock-quote",
        sessionPublicKey: "spk-123",
        quote: "quote-abc"
      }
    }),
    "utf8"
  );

  const result = await readPersistedAuditAttestation({
    eventKey: "0xabc:7",
    baseDir
  });

  assert.equal(result.status, "hash_mismatch");
});

test("readPersistedAuditAttestation returns verifier_mismatch when expected metadata does not match", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "audit-attestation-read-"));
  const persisted = await writeValidArtifact(baseDir, "0xabc:9");

  const result = await readPersistedAuditAttestation({
    eventKey: "0xabc:9",
    baseDir,
    expectedVerifier: {
      providerType: "nitro-enclave"
    }
  });

  assert.deepEqual(result, {
    status: "verifier_mismatch",
    eventKey: "0xabc:9",
    attestationFilePath: persisted.attestationFilePath,
    field: "providerType",
    expected: "nitro-enclave",
    actual: "mock-tee"
  });
});

async function writeSgxDcapArtifact(baseDir: string, eventKey = "0xabc:0") {
  const manifestHash = "a".repeat(64);
  const evidenceRoot = "e".repeat(64);
  const mrEnclave = "c".repeat(64);
  const reportData = computeExpectedReportData(eventKey, manifestHash, evidenceRoot);
  const quoteHex = buildMockSgxDcapQuote({ mrEnclave, reportData });

  const artifact = buildAuditAttestationArtifact({
    schemaVersion: "audit-attestation.v1",
    eventKey,
    tokenId: "1",
    manifestHash,
    evidenceRoot,
    verifier: {
      type: "sgx-dcap",
      measurement: mrEnclave,
      quoteFormat: "sgx-dcap-v3",
      sessionPublicKey: reportData.subarray(0, 32).toString("hex"),
      quote: quoteHex
    }
  });

  return persistAuditAttestation({
    eventKey,
    tokenId: 1n,
    attestationArtifact: artifact,
    baseDir
  });
}

test("readPersistedAuditAttestation verifies SGX DCAP report_data binding when enabled", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "audit-attestation-sgx-"));
  await writeSgxDcapArtifact(baseDir, "0xabc:10");

  const result = await readPersistedAuditAttestation({
    eventKey: "0xabc:10",
    baseDir,
    verifyReportDataBinding: true
  });

  assert.equal(result.status, "verified");
});

test("readPersistedAuditAttestation returns report_data_mismatch when binding fails", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "audit-attestation-sgx-"));
  const eventKey = "0xabc:11";
  const manifestHash = "a".repeat(64);
  const evidenceRoot = "e".repeat(64);
  const mrEnclave = "c".repeat(64);
  // Build report_data with WRONG eventKey
  const wrongReportData = computeExpectedReportData("0xWRONG:0", manifestHash, evidenceRoot);
  const quoteHex = buildMockSgxDcapQuote({ mrEnclave, reportData: wrongReportData });

  const artifact = buildAuditAttestationArtifact({
    schemaVersion: "audit-attestation.v1",
    eventKey,
    tokenId: "1",
    manifestHash,
    evidenceRoot,
    verifier: {
      type: "sgx-dcap",
      measurement: mrEnclave,
      quoteFormat: "sgx-dcap-v3",
      sessionPublicKey: wrongReportData.subarray(0, 32).toString("hex"),
      quote: quoteHex
    }
  });

  await persistAuditAttestation({
    eventKey,
    tokenId: 1n,
    attestationArtifact: artifact,
    baseDir
  });

  const result = await readPersistedAuditAttestation({
    eventKey,
    baseDir,
    verifyReportDataBinding: true
  });

  assert.equal(result.status, "report_data_mismatch");
});

test("readPersistedAuditAttestation skips report_data check for non-sgx-dcap-v3 quotes", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "audit-attestation-sgx-"));
  await writeValidArtifact(baseDir, "0xabc:12");

  const result = await readPersistedAuditAttestation({
    eventKey: "0xabc:12",
    baseDir,
    verifyReportDataBinding: true
  });

  assert.equal(result.status, "verified");
});
