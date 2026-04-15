import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  parseAttestationVerifyCliArgs,
  runAttestationVerifyCli
} from "../../src/cli/attestationVerify";
import { buildAuditAttestationArtifact } from "../../src/attestation/buildAuditAttestation";
import { persistAuditAttestation } from "../../src/attestation/persistAuditAttestation";

test("parseAttestationVerifyCliArgs parses --event-key and optional --state-dir", () => {
  assert.deepEqual(
    parseAttestationVerifyCliArgs(["--event-key", "0xabc:12", "--state-dir", "/tmp/listener-state"]),
    {
      eventKey: "0xabc:12",
      stateDir: "/tmp/listener-state"
    }
  );
});

test("runAttestationVerifyCli prints verified JSON and returns exit code 0", async () => {
  const stateDir = await mkdtemp(path.join(tmpdir(), "sandbox-attestation-verify-state-"));
  const attestationDir = path.join(stateDir, "attestations");
  const artifact = buildAuditAttestationArtifact({
    schemaVersion: "audit-attestation.v1",
    eventKey: "0xabc:0",
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
  const persisted = await persistAuditAttestation({
    eventKey: "0xabc:0",
    tokenId: 1n,
    attestationArtifact: artifact,
    baseDir: attestationDir
  });
  const writes: string[] = [];

  const exitCode = await runAttestationVerifyCli(
    ["--event-key", "0xabc:0", "--state-dir", stateDir],
    process.env,
    {
      writeStdout: (line: string) => {
        writes.push(line);
      }
    }
  );

  assert.equal(exitCode, 0);
  assert.equal(
    writes[0],
    `${JSON.stringify({
      status: "verified",
      eventKey: "0xabc:0",
      attestationFilePath: persisted.attestationFilePath,
      attestationHash: persisted.attestationHash
    })}\n`
  );
});

test("runAttestationVerifyCli passes expected verifier metadata from env", async () => {
  const writes: string[] = [];
  const observed: Array<Record<string, unknown>> = [];

  const exitCode = await runAttestationVerifyCli(
    ["--event-key", "0xabc:0"],
    {
      AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE: "mock-tee",
      AUDIT_ATTESTATION_EXPECTED_MEASUREMENT: "m".repeat(64),
      AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT: "mock-quote"
    },
    {
      writeStdout: (line: string) => {
        writes.push(line);
      },
      readPersistedAuditAttestation: async (options) => {
        observed.push(options.expectedVerifier ?? {});
        return {
          status: "verified",
          eventKey: options.eventKey,
          attestationFilePath: "/tmp/attestations/file.json",
          attestationHash: "f".repeat(64)
        };
      }
    }
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(observed, [
    {
      providerType: "mock-tee",
      measurement: "m".repeat(64),
      quoteFormat: "mock-quote"
    }
  ]);
  assert.equal(writes.length, 1);
});

test("runAttestationVerifyCli passes verifyReportDataBinding when env is set", async () => {
  const observed: Array<{ verifyReportDataBinding?: boolean }> = [];

  const exitCode = await runAttestationVerifyCli(
    ["--event-key", "0xabc:0"],
    {
      AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT: "sgx-dcap-v3",
      AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING: "true"
    },
    {
      writeStdout: () => {},
      readPersistedAuditAttestation: async (options) => {
        observed.push({ verifyReportDataBinding: options.verifyReportDataBinding });
        return {
          status: "verified",
          eventKey: options.eventKey,
          attestationFilePath: "/tmp/attestations/file.json",
          attestationHash: "f".repeat(64)
        };
      }
    }
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(observed, [{ verifyReportDataBinding: true }]);
});
