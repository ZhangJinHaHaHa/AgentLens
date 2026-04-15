const assert = require("assert");
const fs = require("fs");
const path = require("path");

describe("local polygon edge e2e script", function () {
  it("uses the local edge deployer key for listener writeback", function () {
    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "infra",
      "polygon-edge-local",
      "scripts",
      "run-local-e2e.sh"
    );
    const script = fs.readFileSync(scriptPath, "utf8");

    assert.match(
      script,
      /AUDIT_OPERATOR_PRIVATE_KEY="\$\{EDGE_LOCAL_DEPLOYER_PRIVATE_KEY\}"/,
      "listener writeback must use the local Edge deployer key loaded from infra/polygon-edge-local/.env"
    );
  });

  it("configures local report storage so listener writeback can produce a non-empty report CID", function () {
    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "infra",
      "polygon-edge-local",
      "scripts",
      "run-local-e2e.sh"
    );
    const script = fs.readFileSync(scriptPath, "utf8");

    assert.match(
      script,
      /AUDIT_REPORT_COS_LOCAL_DIR="\$\{REPORT_STORAGE_DIR\}\/cos"/,
      "local e2e must enable filesystem-backed COS uploads so report storage works without external Tencent COS access"
    );
    assert.match(
      script,
      /AUDIT_REPORT_IPFS_API_URL="http:\/\/127\.0\.0\.1:\$\{REPORT_STORAGE_PORT\}\/api\/v0\/add"/,
      "local e2e must point the listener at the local IPFS upload mock so a real report CID is produced"
    );
    assert.match(
      script,
      /latestReportCID[\s\S]*must not be empty|must be non-empty/,
      "local e2e must fail fast when the on-chain latestReportCID is still empty after listener writeback"
    );
  });

  it("runs frontend smoke through the local report gateway", function () {
    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "infra",
      "polygon-edge-local",
      "scripts",
      "run-local-e2e.sh"
    );
    const script = fs.readFileSync(scriptPath, "utf8");

    assert.match(
      script,
      /AUDIT_REPORT_GATEWAY_UPSTREAM_BASE_URL="http:\/\/127\.0\.0\.1:\$\{REPORT_STORAGE_PORT\}\/ipfs\/"/,
      "local e2e must start the report gateway against the local IPFS mock"
    );
    assert.match(
      script,
      /VITE_AUDIT_REPORT_GATEWAY_URL="http:\/\/127\.0\.0\.1:\$\{REPORT_GATEWAY_PORT\}\/reports\/"/,
      "frontend smoke must receive the local report gateway URL"
    );
    assert.match(
      script,
      /npm run (?:--silent )?smoke:polygon-edge-local/,
      "local e2e must run the frontend smoke after the report gateway is up"
    );
  });

  it("verifies persisted report and evidence artifacts before printing the local e2e summary", function () {
    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "infra",
      "polygon-edge-local",
      "scripts",
      "run-local-e2e.sh"
    );
    const script = fs.readFileSync(scriptPath, "utf8");

    assert.match(
      script,
      /npm run (?:--silent )?run:report:verify -- --event-key "\$\{EVENT_KEY\}" --state-dir "\$\{LISTENER_STATE_DIR\}"/,
      "local e2e must verify the persisted local report artifact for the processed event"
    );
    assert.match(
      script,
      /npm run (?:--silent )?run:evidence:verify -- --event-key "\$\{EVENT_KEY\}" --state-dir "\$\{LISTENER_STATE_DIR\}"/,
      "local e2e must verify the persisted local evidence artifact for the processed event"
    );
    assert.match(
      script,
      /latestEvidenceRoot/,
      "local e2e summary must include the on-chain evidenceRoot readback field"
    );
    assert.match(
      script,
      /npm run (?:--silent )?run:attestation:verify -- --event-key "\$\{EVENT_KEY\}" --state-dir "\$\{LISTENER_STATE_DIR\}"/,
      "local e2e must verify the persisted local attestation artifact for the processed event"
    );
    assert.match(
      script,
      /AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE="mock-tee"/,
      "local e2e attestation verification must assert the expected provider type"
    );
    assert.match(
      script,
      /AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT="mock-quote"/,
      "local e2e attestation verification must assert the expected quote format"
    );
  });

  it("starts the in-repo attestation API service in command mode and requires a non-zero attestation hash", function () {
    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "infra",
      "polygon-edge-local",
      "scripts",
      "run-local-e2e.sh"
    );
    const script = fs.readFileSync(scriptPath, "utf8");

    assert.match(
      script,
      /npm run --silent run:attestation:api/,
      "local e2e must start the in-repo attestation API service for non-zero attestation hash coverage"
    );
    assert.match(
      script,
      /AUDIT_ATTESTATION_API_URL="http:\/\/127\.0\.0\.1:\$\{ATTESTATION_PORT\}\/attest"/,
      "local e2e must configure listener attestation provider endpoint"
    );
    assert.match(
      script,
      /AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE="command"/,
      "local e2e should exercise the command-mode backend through the in-repo attestation API"
    );
    assert.match(
      script,
      /AUDIT_ATTESTATION_COMMAND="node"/,
      "command-mode attestation backend should be invoked through node in local e2e"
    );
    assert.match(
      script,
      /attestationCommandProvider\.js/,
      "local e2e should use the repo-native command provider backend CLI"
    );
    assert.match(
      script,
      /latestAttestationHash/,
      "local e2e summary must include the latest attestation hash"
    );
    assert.match(
      script,
      /latestAttestationHash must not be zero|latestAttestationHash.*must not be zero/,
      "local e2e must fail fast if attestationHash remains zero after writeback"
    );
  });
});
