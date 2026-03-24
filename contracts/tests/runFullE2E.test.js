const assert = require("assert");
const fs = require("fs");
const path = require("path");

describe("full polygon edge e2e script", function () {
  const scriptPath = path.join(
    __dirname,
    "..",
    "..",
    "infra",
    "polygon-edge-local",
    "scripts",
    "run-full-e2e.sh"
  );

  let script;

  before(function () {
    script = fs.readFileSync(scriptPath, "utf8");
  });

  it("uses set -euo pipefail for strict error handling", function () {
    assert.match(
      script,
      /^#!\/bin\/bash\nset -euo pipefail/,
      "full e2e script must use strict bash error handling"
    );
  });

  it("supports --mode mock and --mode sgx attestation modes", function () {
    assert.match(
      script,
      /ATTESTATION_MODE="mock"/,
      "full e2e must default to mock attestation mode"
    );
    assert.match(
      script,
      /--mode\)/,
      "full e2e must accept a --mode argument"
    );
    assert.match(
      script,
      /mock.*sgx/s,
      "full e2e must support both mock and sgx modes"
    );
  });

  it("uses the local edge deployer key for listener writeback", function () {
    assert.match(
      script,
      /AUDIT_OPERATOR_PRIVATE_KEY="\$\{EDGE_LOCAL_DEPLOYER_PRIVATE_KEY\}"/,
      "listener writeback must use the local Edge deployer key"
    );
  });

  it("configures local report storage with COS local dir and IPFS mock", function () {
    assert.match(
      script,
      /AUDIT_REPORT_COS_LOCAL_DIR="\$\{REPORT_STORAGE_DIR\}\/cos"/,
      "full e2e must enable filesystem-backed COS uploads"
    );
    assert.match(
      script,
      /AUDIT_REPORT_IPFS_API_URL="http:\/\/127\.0\.0\.1:\$\{REPORT_STORAGE_PORT\}\/api\/v0\/add"/,
      "full e2e must point the listener at the local IPFS upload mock"
    );
  });

  it("configures attestation API URL and provider type for the listener", function () {
    assert.match(
      script,
      /AUDIT_ATTESTATION_API_URL="\$\{ATTESTATION_API_URL\}"/,
      "full e2e must pass the attestation API URL to the listener"
    );
    assert.match(
      script,
      /AUDIT_ATTESTATION_PROVIDER_TYPE="\$\{ATTESTATION_PROVIDER_TYPE\}"/,
      "full e2e must pass the attestation provider type to the listener"
    );
  });

  it("starts attestation API service in command mode for mock", function () {
    assert.match(
      script,
      /AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE="command"/,
      "full e2e must use command provider mode for mock attestation"
    );
    assert.match(
      script,
      /AUDIT_ATTESTATION_COMMAND="node"/,
      "command mode should use node to run the command provider"
    );
    assert.match(
      script,
      /attestationCommandProvider\.js/,
      "full e2e should use the repo-native command provider backend CLI"
    );
  });

  it("runs all three verify CLIs after listener writeback", function () {
    assert.match(
      script,
      /npm run --silent run:report:verify -- --event-key "\$\{LISTENER_EVENT_KEY\}" --state-dir "\$\{LISTENER_STATE_DIR\}"/,
      "full e2e must verify the persisted report artifact"
    );
    assert.match(
      script,
      /npm run --silent run:evidence:verify -- --event-key "\$\{LISTENER_EVENT_KEY\}" --state-dir "\$\{LISTENER_STATE_DIR\}"/,
      "full e2e must verify the persisted evidence artifact"
    );
    assert.match(
      script,
      /npm run --silent run:attestation:verify -- --event-key "\$\{LISTENER_EVENT_KEY\}" --state-dir "\$\{LISTENER_STATE_DIR\}"/,
      "full e2e must verify the persisted attestation artifact"
    );
  });

  it("validates attestation hash is non-zero after writeback", function () {
    assert.match(
      script,
      /latestAttestationHash must not be zero/,
      "full e2e must fail fast if attestationHash remains zero after writeback"
    );
  });

  it("validates report CID is non-empty after writeback", function () {
    assert.match(
      script,
      /latestReportCID[\s\S]*must not be empty/,
      "full e2e must fail fast when the on-chain latestReportCID is still empty"
    );
  });

  it("outputs a final summary with all verification results", function () {
    assert.match(
      script,
      /reportVerified/,
      "final summary must include reportVerified"
    );
    assert.match(
      script,
      /evidenceVerified/,
      "final summary must include evidenceVerified"
    );
    assert.match(
      script,
      /attestationVerified/,
      "final summary must include attestationVerified"
    );
    assert.match(
      script,
      /attestationMode/,
      "final summary must include attestationMode"
    );
    assert.match(
      script,
      /latestEvidenceRoot/,
      "final summary must include latestEvidenceRoot"
    );
    assert.match(
      script,
      /latestAttestationHash/,
      "final summary must include latestAttestationHash"
    );
  });

  it("includes the report gateway and frontend smoke steps", function () {
    assert.match(
      script,
      /AUDIT_REPORT_GATEWAY_UPSTREAM_BASE_URL="http:\/\/127\.0\.0\.1:\$\{REPORT_STORAGE_PORT\}\/ipfs\/"/,
      "full e2e must start the report gateway against the local IPFS mock"
    );
    assert.match(
      script,
      /smoke:polygon-edge-local/,
      "full e2e must run the frontend smoke"
    );
  });

  it("cleans up all background processes on exit", function () {
    assert.match(
      script,
      /trap cleanup EXIT/,
      "full e2e must register a cleanup trap"
    );
    assert.match(
      script,
      /MOCK_ATTESTATION_PID/,
      "cleanup must track the attestation process"
    );
    assert.match(
      script,
      /REPORT_STORAGE_PID/,
      "cleanup must track the report storage process"
    );
    assert.match(
      script,
      /REPORT_GATEWAY_PID/,
      "cleanup must track the report gateway process"
    );
  });
});
