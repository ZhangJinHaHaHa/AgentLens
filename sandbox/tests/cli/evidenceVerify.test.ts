import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  parseEvidenceVerifyCliArgs,
  runEvidenceVerifyCli
} from "../../src/cli/evidenceVerify";
import { appendAuditEvidenceEvent, createAuditEvidenceChainContext } from "../../src/evidence/evidenceChain";
import { persistAuditEvidence } from "../../src/evidence/persistAuditEvidence";

test("parseEvidenceVerifyCliArgs parses --event-key and optional --state-dir", () => {
  assert.deepEqual(
    parseEvidenceVerifyCliArgs(["--event-key", "0xabc:12", "--state-dir", "/tmp/listener-state"]),
    {
      eventKey: "0xabc:12",
      stateDir: "/tmp/listener-state"
    }
  );
});

test("runEvidenceVerifyCli prints verified JSON and returns exit code 0", async () => {
  const stateDir = await mkdtemp(path.join(tmpdir(), "sandbox-evidence-verify-state-"));
  const evidenceDir = path.join(stateDir, "evidence");
  const context = createAuditEvidenceChainContext({
    eventKey: "0xabc:0",
    tokenId: 1n
  });
  appendAuditEvidenceEvent(context, {
    stage: "audit_requested_observed",
    timestamp: "2026-04-06T10:00:00.000Z",
    payload: { manifestUrl: "https://example.com/manifest.json" }
  });
  const persisted = await persistAuditEvidence({
    eventKey: "0xabc:0",
    tokenId: 1n,
    chain: context,
    baseDir: evidenceDir
  });
  const writes: string[] = [];

  const exitCode = await runEvidenceVerifyCli(
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
      evidenceFilePath: persisted.evidenceFilePath,
      evidenceRoot: persisted.evidenceRoot
    })}\n`
  );
});
