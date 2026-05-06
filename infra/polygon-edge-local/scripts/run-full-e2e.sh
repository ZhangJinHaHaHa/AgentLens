#!/bin/bash
set -euo pipefail

# =============================================================================
# Full E2E test: Polygon Edge -> Deploy -> Stake -> Attestation -> Listener ->
#                Writeback -> Verify (report + evidence + attestation)
#
# Usage:
#   ./run-full-e2e.sh              # default: mock attestation mode
#   ./run-full-e2e.sh --mode mock  # explicit mock attestation mode
#   ./run-full-e2e.sh --mode sgx   # remote SGX attestation via real TEE API
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EDGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${EDGE_DIR}/../.." && pwd)"
CONTRACTS_DIR="${REPO_ROOT}/contracts"
SANDBOX_DIR="${REPO_ROOT}/sandbox"
FRONTEND_DIR="${REPO_ROOT}/frontend"
EDGE_ENV_FILE="${EDGE_DIR}/.env"
EDGE_ENV_EXAMPLE_FILE="${EDGE_DIR}/.env.example"
CONTRACTS_ENV_FILE="${CONTRACTS_DIR}/.env.edge.local.example"
DEPLOYMENT_FILE="${CONTRACTS_DIR}/deployments/polygon-edge-local/AgentAuditRegistry.json"
MANIFEST_PATH="${SANDBOX_DIR}/fixtures/manifest.local.json"
AGENT_NAME="local-test-agent"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/agent-shenji-full-e2e.XXXXXX")"
STAKE_RESULT_FILE="${TMP_DIR}/stake.json"
LISTENER_OUTPUT_FILE="${TMP_DIR}/listener.log"
READBACK_FILE="${TMP_DIR}/readback.json"
REPORT_STORAGE_DIR="${TMP_DIR}/report-storage"
REPORT_STORAGE_LOG="${TMP_DIR}/report-storage.log"
REPORT_GATEWAY_LOG="${TMP_DIR}/report-gateway.log"
REPORT_VERIFY_FILE="${TMP_DIR}/report-verify.json"
EVIDENCE_VERIFY_FILE="${TMP_DIR}/evidence-verify.json"
ATTESTATION_VERIFY_FILE="${TMP_DIR}/attestation-verify.json"
LISTENER_STATE_DIR="${TMP_DIR}/listener-state"
FRONTEND_SMOKE_OUTPUT_FILE="${TMP_DIR}/frontend-smoke.json"
FRONTEND_SMOKE_SUMMARY_FILE="${TMP_DIR}/frontend-smoke-summary.json"
REPORT_STORAGE_PID=""
REPORT_GATEWAY_PID=""
MOCK_ATTESTATION_PID=""

# ---- parse arguments ----
ATTESTATION_MODE="mock"
SGX_ATTESTATION_API_URL="${SGX_ATTESTATION_API_URL:-http://43.134.90.165:3311}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      ATTESTATION_MODE="$2"
      shift 2
      ;;
    --sgx-url)
      SGX_ATTESTATION_API_URL="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--mode mock|sgx] [--sgx-url <url>]" >&2
      exit 1
      ;;
  esac
done

if [[ "${ATTESTATION_MODE}" != "mock" && "${ATTESTATION_MODE}" != "sgx" ]]; then
  echo "Invalid attestation mode: ${ATTESTATION_MODE}. Must be 'mock' or 'sgx'." >&2
  exit 1
fi

cleanup() {
  if [ -n "${MOCK_ATTESTATION_PID}" ] && kill -0 "${MOCK_ATTESTATION_PID}" >/dev/null 2>&1; then
    kill "${MOCK_ATTESTATION_PID}" >/dev/null 2>&1 || true
    wait "${MOCK_ATTESTATION_PID}" >/dev/null 2>&1 || true
  fi

  if [ -n "${REPORT_GATEWAY_PID}" ] && kill -0 "${REPORT_GATEWAY_PID}" >/dev/null 2>&1; then
    kill "${REPORT_GATEWAY_PID}" >/dev/null 2>&1 || true
    wait "${REPORT_GATEWAY_PID}" >/dev/null 2>&1 || true
  fi

  if [ -n "${REPORT_STORAGE_PID}" ] && kill -0 "${REPORT_STORAGE_PID}" >/dev/null 2>&1; then
    kill "${REPORT_STORAGE_PID}" >/dev/null 2>&1 || true
    wait "${REPORT_STORAGE_PID}" >/dev/null 2>&1 || true
  fi

  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

log_step() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

wait_for_rpc() {
  local rpc_url="$1"
  local attempts="${2:-30}"

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl -sS -X POST "${rpc_url}" \
      -H 'Content-Type: application/json' \
      --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' >/dev/null; then
      return 0
    fi

    sleep 1
  done

  echo "Timed out waiting for JSON-RPC readiness at ${rpc_url}" >&2
  return 1
}

wait_for_http() {
  local url="$1"
  local attempts="${2:-30}"

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl -fsS "${url}" >/dev/null; then
      return 0
    fi

    sleep 1
  done

  echo "Timed out waiting for HTTP readiness at ${url}" >&2
  return 1
}

find_free_port() {
  local start_port="$1"

  node - "${start_port}" <<'NODE'
const net = require("net");

const startPort = Number.parseInt(process.argv[2], 10);
const maxAttempts = 50;

function probe(port, remaining) {
  const server = net.createServer();

  server.once("error", () => {
    server.close(() => {
      if (remaining <= 1) {
        process.stderr.write(`Unable to find an available port starting from ${startPort}\n`);
        process.exit(1);
      }

      probe(port + 1, remaining - 1);
    });
  });

  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => {
      process.stdout.write(String(address.port));
    });
  });
}

probe(startPort, maxAttempts);
NODE
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

load_env_file() {
  local file_path="$1"

  if [ ! -f "${file_path}" ]; then
    echo "Missing environment file: ${file_path}" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "${file_path}"
  set +a
}

parse_json_stream_event() {
  local input_file="$1"
  local event_type="$2"

  node - "${input_file}" "${event_type}" <<'NODE'
const fs = require("fs");

const inputPath = process.argv[2];
const eventType = process.argv[3];
const input = fs.readFileSync(inputPath, "utf8");
const objects = [];
let depth = 0;
let start = -1;

for (let index = 0; index < input.length; index += 1) {
  const char = input[index];

  if (char === "{") {
    if (depth === 0) {
      start = index;
    }
    depth += 1;
    continue;
  }

  if (char === "}") {
    depth -= 1;

    if (depth === 0 && start >= 0) {
      objects.push(JSON.parse(input.slice(start, index + 1)));
      start = -1;
    }
  }
}

const matched = objects.find((entry) => entry.type === eventType);

if (!matched) {
  process.exit(1);
}

process.stdout.write(JSON.stringify(matched, null, 2));
NODE
}

extract_json_field() {
  local file_path="$1"
  local field_name="$2"

  node - "${file_path}" "${field_name}" <<'NODE'
const fs = require("fs");
const filePath = process.argv[2];
const fieldName = process.argv[3];
const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
const value = data[fieldName];
process.stdout.write(value === undefined || value === null ? "" : String(value));
NODE
}

require_command docker
require_command npm
require_command node
require_command curl

REPORT_STORAGE_PORT="$(find_free_port 3301)"
REPORT_GATEWAY_PORT="$(find_free_port 3101)"
MOCK_ATTESTATION_PORT="$(find_free_port 3311)"

if [ ! -f "${EDGE_ENV_FILE}" ]; then
  cp "${EDGE_ENV_EXAMPLE_FILE}" "${EDGE_ENV_FILE}"
fi

load_env_file "${EDGE_ENV_FILE}"

# =============================================================================
# Step 1: Start local Polygon Edge
# =============================================================================
log_step "Starting local Polygon Edge"
(
  cd "${EDGE_DIR}"
  docker compose up -d --build
)

log_step "Probing local JSON-RPC"
wait_for_rpc "http://127.0.0.1:${EDGE_LOCAL_RPC_PORT}"

# =============================================================================
# Step 2: Deploy contract
# =============================================================================
log_step "Deploying AgentAuditRegistry"
(
  cd "${CONTRACTS_DIR}"
  load_env_file "${CONTRACTS_ENV_FILE}"
  npm run deploy:edge >/dev/null
)

if [ ! -f "${DEPLOYMENT_FILE}" ]; then
  echo "Deployment metadata was not written: ${DEPLOYMENT_FILE}" >&2
  exit 1
fi

REGISTRY_ADDRESS="$(extract_json_field "${DEPLOYMENT_FILE}" "address")"

# =============================================================================
# Step 3: Start attestation service (mock or SGX remote)
# =============================================================================
ATTESTATION_API_URL=""
ATTESTATION_PROVIDER_TYPE=""
ATTESTATION_PORT="${MOCK_ATTESTATION_PORT}"

if [[ "${ATTESTATION_MODE}" == "mock" ]]; then
  log_step "Starting local attestation API service (command mode)"
  (
    cd "${SANDBOX_DIR}"
    AUDIT_ATTESTATION_SERVICE_HOST="127.0.0.1" \
    AUDIT_ATTESTATION_SERVICE_PORT="${ATTESTATION_PORT}" \
    AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE="command" \
    AUDIT_ATTESTATION_COMMAND="node" \
    AUDIT_ATTESTATION_COMMAND_ARGS="dist/src/cli/attestationCommandProvider.js" \
    AUDIT_ATTESTATION_COMMAND_PROVIDER_TYPE="mock-tee" \
    TEE_COMMAND_PROVIDER_QUOTE_FORMAT="mock-quote" \
    npm run --silent run:attestation:api >"${TMP_DIR}/attestation.log" 2>&1
  ) &
  MOCK_ATTESTATION_PID=$!
  wait_for_http "http://127.0.0.1:${ATTESTATION_PORT}/health"

  ATTESTATION_API_URL="http://127.0.0.1:${ATTESTATION_PORT}/attest"
  ATTESTATION_PROVIDER_TYPE="mock-tee"
else
  log_step "Using remote SGX attestation API at ${SGX_ATTESTATION_API_URL}"
  ATTESTATION_API_URL="${SGX_ATTESTATION_API_URL}/attest"
  ATTESTATION_PROVIDER_TYPE="sgx-dcap"
fi

# =============================================================================
# Step 4: Build test agent & emit audit request
# =============================================================================
log_step "Building local test-agent image"
(
  cd "${SANDBOX_DIR}"
  npm run build:test-agent >/dev/null
)

log_step "Emitting AuditRequested via stake()"
(
  cd "${CONTRACTS_DIR}"
  load_env_file "${CONTRACTS_ENV_FILE}"
  STAKE_RESULT_FILE="${STAKE_RESULT_FILE}" \
  REGISTRY_ADDRESS="${REGISTRY_ADDRESS}" \
  MANIFEST_PATH="${MANIFEST_PATH}" \
  AGENT_NAME="${AGENT_NAME}" \
  node <<'NODE'
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

(async () => {
  const artifact = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "artifacts", "AgentAuditRegistry.json"), "utf8")
  );
  const provider = new ethers.providers.JsonRpcProvider(process.env.EDGE_RPC_URL, {
    chainId: Number.parseInt(process.env.EDGE_CHAIN_ID, 10),
    name: process.env.EDGE_NETWORK_NAME ?? "polygon-edge-local"
  });
  const wallet = new ethers.Wallet(process.env.EDGE_DEPLOYER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(process.env.REGISTRY_ADDRESS, artifact.abi, wallet);
  const tx = await contract.stake(process.env.AGENT_NAME, process.env.MANIFEST_PATH, {
    value: ethers.utils.parseEther("1.01")
  });
  const receipt = await tx.wait();
  const tokenId = await contract.getTokenId(wallet.address, process.env.AGENT_NAME);
  const result = {
    transactionHash: tx.hash,
    blockNumber: receipt.blockNumber,
    tokenId: tokenId.toString(),
    manifestPath: process.env.MANIFEST_PATH
  };
  fs.writeFileSync(process.env.STAKE_RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`);
})();
NODE
)

STAKE_BLOCK_NUMBER="$(extract_json_field "${STAKE_RESULT_FILE}" "blockNumber")"

# =============================================================================
# Step 5: Start mock report storage
# =============================================================================
log_step "Starting local mock report storage"
mkdir -p "${REPORT_STORAGE_DIR}"
MOCK_REPORT_STORAGE_HOST="127.0.0.1" \
MOCK_REPORT_STORAGE_PORT="${REPORT_STORAGE_PORT}" \
MOCK_REPORT_STORAGE_DIR="${REPORT_STORAGE_DIR}" \
node "${SCRIPT_DIR}/mock-report-storage-server.js" >"${REPORT_STORAGE_LOG}" 2>&1 &
REPORT_STORAGE_PID=$!
wait_for_http "http://127.0.0.1:${REPORT_STORAGE_PORT}/health"

# =============================================================================
# Step 6: Run listener with attestation enabled
# =============================================================================
log_step "Running listener once with writeback + attestation enabled (mode=${ATTESTATION_MODE})"
mkdir -p "${LISTENER_STATE_DIR}"
(
  cd "${SANDBOX_DIR}"
  AUDIT_RPC_URL="http://127.0.0.1:${EDGE_LOCAL_RPC_PORT}" \
  AUDIT_REGISTRY_ADDRESS="${REGISTRY_ADDRESS}" \
  AUDIT_LISTENER_START_BLOCK="${STAKE_BLOCK_NUMBER}" \
  AUDIT_LISTENER_STATE_DIR="${LISTENER_STATE_DIR}" \
  AUDIT_WRITEBACK_ENABLED=true \
  AUDIT_OPERATOR_PRIVATE_KEY="${EDGE_LOCAL_DEPLOYER_PRIVATE_KEY}" \
  AUDIT_CHAIN_ID="${EDGE_LOCAL_CHAIN_ID}" \
  AUDIT_REPORT_COS_LOCAL_DIR="${REPORT_STORAGE_DIR}/cos" \
  AUDIT_REPORT_IPFS_API_URL="http://127.0.0.1:${REPORT_STORAGE_PORT}/api/v0/add" \
  AUDIT_ATTESTATION_API_URL="${ATTESTATION_API_URL}" \
  AUDIT_ATTESTATION_PROVIDER_TYPE="${ATTESTATION_PROVIDER_TYPE}" \
  npm run run:listener:once >"${LISTENER_OUTPUT_FILE}"
)

if ! parse_json_stream_event "${LISTENER_OUTPUT_FILE}" "writeback-confirmed" >/dev/null; then
  echo "Listener run did not emit writeback-confirmed" >&2
  cat "${LISTENER_OUTPUT_FILE}" >&2
  exit 1
fi

# =============================================================================
# Step 7: Read back on-chain audit state
# =============================================================================
log_step "Reading back on-chain audit state"
(
  cd "${CONTRACTS_DIR}"
  load_env_file "${CONTRACTS_ENV_FILE}"
  READBACK_FILE="${READBACK_FILE}" \
  REGISTRY_ADDRESS="${REGISTRY_ADDRESS}" \
  node <<'NODE'
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

(async () => {
  const artifact = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "artifacts", "AgentAuditRegistry.json"), "utf8")
  );
  const provider = new ethers.providers.JsonRpcProvider(process.env.EDGE_RPC_URL, {
    chainId: Number.parseInt(process.env.EDGE_CHAIN_ID, 10),
    name: process.env.EDGE_NETWORK_NAME ?? "polygon-edge-local"
  });
  const contract = new ethers.Contract(process.env.REGISTRY_ADDRESS, artifact.abi, provider);
  const tokenId = 1;
  const profile = await contract.getAgentProfile(tokenId);
  const latest = await contract.getLatestAuditReport(tokenId);
  const count = await contract.getAuditCount(tokenId);

  const result = {
    tokenId,
    auditCount: count.toString(),
    profileAuditCount: profile.auditCount.toString(),
    latestStatus: latest.status.toString(),
    latestAuditScore: latest.auditScore.toString(),
    latestManifestUrl: latest.manifestUrl,
    latestReportCID: latest.reportCID,
    latestManifestHash: latest.manifestHash,
    latestReportHash: latest.reportHash,
    latestEvidenceRoot: latest.evidenceRoot ?? null,
    latestAttestationHash: latest.attestationHash ?? null,
    lastAuditAt: profile.lastAuditAt.toString()
  };

  fs.writeFileSync(process.env.READBACK_FILE, `${JSON.stringify(result, null, 2)}\n`);
})();
NODE
)

LATEST_REPORT_CID="$(extract_json_field "${READBACK_FILE}" "latestReportCID")"

if [ -z "${LATEST_REPORT_CID}" ]; then
  echo "latestReportCID must not be empty after listener writeback" >&2
  cat "${READBACK_FILE}" >&2
  exit 1
fi

LATEST_ATTESTATION_HASH="$(extract_json_field "${READBACK_FILE}" "latestAttestationHash")"

if [ -z "${LATEST_ATTESTATION_HASH}" ] || [ "${LATEST_ATTESTATION_HASH}" = "0x0000000000000000000000000000000000000000000000000000000000000000" ]; then
  echo "latestAttestationHash must not be zero after listener writeback" >&2
  cat "${READBACK_FILE}" >&2
  exit 1
fi

# =============================================================================
# Step 8: Extract eventKey and run verify CLIs
# =============================================================================
log_step "Extracting eventKey from listener output"
LISTENER_EVENT_KEY="$(
  node - "${LISTENER_OUTPUT_FILE}" <<'NODE'
const fs = require("fs");
const input = fs.readFileSync(process.argv[2], "utf8");
const objects = [];
let depth = 0;
let start = -1;
for (let i = 0; i < input.length; i += 1) {
  if (input[i] === "{") { if (depth === 0) start = i; depth += 1; }
  if (input[i] === "}") { depth -= 1; if (depth === 0 && start >= 0) { objects.push(JSON.parse(input.slice(start, i + 1))); start = -1; } }
}
const wc = objects.find((o) => o.type === "writeback-confirmed");
if (!wc || !wc.eventKey) { process.exit(1); }
process.stdout.write(wc.eventKey);
NODE
)"

log_step "Running report verify CLI (eventKey=${LISTENER_EVENT_KEY})"
(
  cd "${SANDBOX_DIR}"
  AUDIT_LISTENER_STATE_DIR="${LISTENER_STATE_DIR}" \
  npm run --silent run:report:verify -- --event-key "${LISTENER_EVENT_KEY}" --state-dir "${LISTENER_STATE_DIR}" \
    >"${REPORT_VERIFY_FILE}" 2>&1
) || true

REPORT_VERIFY_STATUS="$(extract_json_field "${REPORT_VERIFY_FILE}" "status")"
if [ "${REPORT_VERIFY_STATUS}" != "verified" ]; then
  echo "Report verification failed: ${REPORT_VERIFY_STATUS}" >&2
  cat "${REPORT_VERIFY_FILE}" >&2
  exit 1
fi

log_step "Running evidence verify CLI"
(
  cd "${SANDBOX_DIR}"
  AUDIT_LISTENER_STATE_DIR="${LISTENER_STATE_DIR}" \
  npm run --silent run:evidence:verify -- --event-key "${LISTENER_EVENT_KEY}" --state-dir "${LISTENER_STATE_DIR}" \
    >"${EVIDENCE_VERIFY_FILE}" 2>&1
) || true

EVIDENCE_VERIFY_STATUS="$(extract_json_field "${EVIDENCE_VERIFY_FILE}" "status")"
if [ "${EVIDENCE_VERIFY_STATUS}" != "verified" ]; then
  echo "Evidence verification failed: ${EVIDENCE_VERIFY_STATUS}" >&2
  cat "${EVIDENCE_VERIFY_FILE}" >&2
  exit 1
fi

log_step "Running attestation verify CLI"
ATTESTATION_VERIFY_ENV_VARS=(
  "AUDIT_LISTENER_STATE_DIR=${LISTENER_STATE_DIR}"
)
if [[ "${ATTESTATION_MODE}" == "mock" ]]; then
  ATTESTATION_VERIFY_ENV_VARS+=(
    "AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE=mock-tee"
    "AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT=mock-quote"
  )
else
  ATTESTATION_VERIFY_ENV_VARS+=(
    "AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE=sgx-dcap"
    "AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT=sgx-dcap-v3"
  )
fi
(
  cd "${SANDBOX_DIR}"
  env "${ATTESTATION_VERIFY_ENV_VARS[@]}" \
  npm run --silent run:attestation:verify -- --event-key "${LISTENER_EVENT_KEY}" --state-dir "${LISTENER_STATE_DIR}" \
    >"${ATTESTATION_VERIFY_FILE}" 2>&1
) || true

ATTESTATION_VERIFY_STATUS="$(extract_json_field "${ATTESTATION_VERIFY_FILE}" "status")"
if [ "${ATTESTATION_VERIFY_STATUS}" != "verified" ]; then
  echo "Attestation verification failed: ${ATTESTATION_VERIFY_STATUS}" >&2
  cat "${ATTESTATION_VERIFY_FILE}" >&2
  exit 1
fi

# =============================================================================
# Step 9: Start report gateway and run frontend smoke
# =============================================================================
log_step "Starting local report gateway"
(
  cd "${SANDBOX_DIR}"
  AUDIT_REPORT_GATEWAY_HOST="127.0.0.1" \
  AUDIT_REPORT_GATEWAY_PORT="${REPORT_GATEWAY_PORT}" \
  AUDIT_REPORT_GATEWAY_UPSTREAM_BASE_URL="http://127.0.0.1:${REPORT_STORAGE_PORT}/ipfs/" \
  npm run --silent run:report:gateway >"${REPORT_GATEWAY_LOG}" 2>&1
) &
REPORT_GATEWAY_PID=$!
wait_for_http "http://127.0.0.1:${REPORT_GATEWAY_PORT}/health"

if [ -d "${FRONTEND_DIR}" ]; then
  log_step "Running frontend smoke through local report gateway"
  (
    cd "${FRONTEND_DIR}"
    VITE_AUDIT_REPORT_GATEWAY_URL="http://127.0.0.1:${REPORT_GATEWAY_PORT}/reports/" \
    LOCAL_FRONTEND_SMOKE_AGENT_NAME="${AGENT_NAME}" \
    LOCAL_FRONTEND_SMOKE_SUMMARY_FILE="${FRONTEND_SMOKE_SUMMARY_FILE}" \
    npm run --silent smoke:polygon-edge-local >"${FRONTEND_SMOKE_OUTPUT_FILE}"
  ) || log_step "Frontend smoke skipped or failed (non-blocking)"
fi

# =============================================================================
# Step 10: Output final summary
# =============================================================================
log_step "Full E2E summary"
node - \
  "${DEPLOYMENT_FILE}" \
  "${STAKE_RESULT_FILE}" \
  "${LISTENER_OUTPUT_FILE}" \
  "${READBACK_FILE}" \
  "${REPORT_VERIFY_FILE}" \
  "${EVIDENCE_VERIFY_FILE}" \
  "${ATTESTATION_VERIFY_FILE}" \
  "${ATTESTATION_MODE}" \
  <<'NODE'
const fs = require("fs");

const deployment = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const stake = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const readback = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const reportVerify = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const evidenceVerify = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
const attestationVerify = JSON.parse(fs.readFileSync(process.argv[8], "utf8"));
const attestationMode = process.argv[9];

const input = fs.readFileSync(process.argv[4], "utf8");
function extractJsonObjects(text) {
  const parsed = [];
  let depth = 0;
  let start = -1;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0 && start >= 0) {
        parsed.push(JSON.parse(text.slice(start, index + 1)));
        start = -1;
      }
    }
  }

  return parsed;
}

const objects = extractJsonObjects(input);
const writebackConfirmed = objects.find((entry) => entry.type === "writeback-confirmed");
const listenerPoll = objects.find((entry) => entry.type === "listener-poll");

process.stdout.write(`${JSON.stringify({
  status: "pass",
  attestationMode,
  rpcUrl: deployment.rpcUrl,
  chainId: deployment.chainId,
  registryAddress: deployment.address,
  stakeTransactionHash: stake.transactionHash,
  stakeBlockNumber: stake.blockNumber,
  tokenId: stake.tokenId,
  writebackTransactionHash: writebackConfirmed?.transactionHash ?? null,
  writebackBlockNumber: writebackConfirmed?.blockNumber ?? null,
  processedCount: listenerPoll?.processedCount ?? null,
  latestStatus: readback.latestStatus,
  latestAuditScore: readback.latestAuditScore,
  latestReportCID: readback.latestReportCID,
  latestManifestHash: readback.latestManifestHash,
  latestReportHash: readback.latestReportHash,
  latestEvidenceRoot: readback.latestEvidenceRoot ?? null,
  latestAttestationHash: readback.latestAttestationHash ?? null,
  reportVerified: reportVerify.status === "verified",
  evidenceVerified: evidenceVerify.status === "verified",
  attestationVerified: attestationVerify.status === "verified"
}, null, 2)}\n`);
NODE
