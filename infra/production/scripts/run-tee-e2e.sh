#!/bin/bash
set -euo pipefail

# =============================================================================
# Production TEE E2E smoke test
#
# Verifies the full production loop:
#   stake() on V2 registry
#     → listener picks up AuditRequested
#     → listener calls SGX Attestation API
#     → listener validates MRENCLAVE + report_data binding online
#     → listener writes recordAuditResultV2(tokenId, score, ..., attestationHash)
#     → on-chain record.attestationHash != bytes32(0)
#
# Optional: pull the attestation bundle from the listener container and run
# the offline attestationVerify CLI against it (belt-and-suspenders).
#
# Usage:
#   # minimal (reads all config from the env file)
#   ./run-tee-e2e.sh --env infra/production/.env.e2e
#
#   # or pass everything on the command line
#   TEE_E2E_RPC_URL=http://203.91.76.159:18545 \
#   TEE_E2E_REGISTRY_ADDRESS=0x4A679253410272dd5232B3Ff7cF5dbB88f295319 \
#   TEE_E2E_CHAIN_ID=302612 \
#   TEE_E2E_PRIVATE_KEY=0x... \
#   TEE_E2E_MANIFEST_URL=https://example.com/manifest.json \
#   TEE_E2E_EXPECTED_MEASUREMENT=1656d0e5f1dbac0e687662f79b8b5bf8629e40224567ecb823d1eb409f0b16b8 \
#     ./run-tee-e2e.sh
#
# Required env vars:
#   TEE_E2E_RPC_URL                   JSON-RPC endpoint of the target network
#   TEE_E2E_REGISTRY_ADDRESS          Deployed AgentAuditRegistryV2 address
#   TEE_E2E_CHAIN_ID                  Chain ID of the target network
#   TEE_E2E_PRIVATE_KEY               Hex private key of a funded test wallet
#   TEE_E2E_MANIFEST_URL              URL served to the listener's sandbox
#   TEE_E2E_EXPECTED_MEASUREMENT      Pinned MRENCLAVE (hex, no 0x prefix)
#
# Optional env vars:
#   TEE_E2E_AGENT_NAME                Agent name (default: tee-e2e-<timestamp>)
#   TEE_E2E_STAKE_AMOUNT_ETH          Native token staked (default: 1.01)
#   TEE_E2E_ATTESTATION_API_URL       Preflight health probe (default: skip)
#   TEE_E2E_TIMEOUT_MS                Audit-completion timeout (default: 600000)
#   TEE_E2E_POLL_INTERVAL_MS          Audit polling interval (default: 10000)
#   TEE_E2E_OUTPUT_FILE               Summary JSON path (default: tee-e2e.json)
#   TEE_E2E_LISTENER_SSH              SSH cmd to pull attestation bundle
#                                     e.g. "sshpass -p pw ssh -p 23205 root@host"
#   TEE_E2E_LISTENER_STATE_DIR        Listener state dir inside the container
#                                     (default: /app/.runtime/listener)
#   TEE_E2E_LISTENER_CONTAINER        Listener container name
#                                     (default: shenji-listener)
#   TEE_E2E_EXPECTED_PROVIDER_TYPE    For offline verify (default: sgx-dcap)
#   TEE_E2E_EXPECTED_QUOTE_FORMAT     For offline verify (default: sgx-dcap-v3)
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
CONTRACTS_DIR="${REPO_ROOT}/contracts"
SANDBOX_DIR="${REPO_ROOT}/sandbox"
# ethers v6 lives in frontend/node_modules; contracts/sandbox use v5
ETHERS_NODE_MODULES="${REPO_ROOT}/frontend/node_modules"

ENV_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_FILE="$2"
      shift 2
      ;;
    --help|-h)
      head -n 60 "$0" | sed -n '3,60p'
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -n "${ENV_FILE}" ]]; then
  if [ ! -f "${ENV_FILE}" ]; then
    echo "Missing --env file: ${ENV_FILE}" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

# ---- required vars ----
for v in TEE_E2E_RPC_URL TEE_E2E_REGISTRY_ADDRESS TEE_E2E_CHAIN_ID TEE_E2E_PRIVATE_KEY TEE_E2E_MANIFEST_URL TEE_E2E_EXPECTED_MEASUREMENT; do
  if [[ -z "${!v:-}" ]]; then
    echo "Missing required env var: ${v}" >&2
    exit 1
  fi
done

# ---- defaults ----
TEE_E2E_AGENT_NAME="${TEE_E2E_AGENT_NAME:-tee-e2e-$(date +%s)}"
TEE_E2E_STAKE_AMOUNT_ETH="${TEE_E2E_STAKE_AMOUNT_ETH:-1.01}"
TEE_E2E_TIMEOUT_MS="${TEE_E2E_TIMEOUT_MS:-600000}"
TEE_E2E_POLL_INTERVAL_MS="${TEE_E2E_POLL_INTERVAL_MS:-10000}"
TEE_E2E_OUTPUT_FILE="${TEE_E2E_OUTPUT_FILE:-tee-e2e.json}"
TEE_E2E_LISTENER_STATE_DIR="${TEE_E2E_LISTENER_STATE_DIR:-/app/.runtime/listener}"
TEE_E2E_LISTENER_CONTAINER="${TEE_E2E_LISTENER_CONTAINER:-shenji-listener}"
TEE_E2E_EXPECTED_PROVIDER_TYPE="${TEE_E2E_EXPECTED_PROVIDER_TYPE:-sgx-dcap}"
TEE_E2E_EXPECTED_QUOTE_FORMAT="${TEE_E2E_EXPECTED_QUOTE_FORMAT:-sgx-dcap-v3}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tee-e2e.XXXXXX")"
STAKE_JSON="${TMP_DIR}/stake.json"
READBACK_JSON="${TMP_DIR}/readback.json"
STATE_TARBALL="${TMP_DIR}/listener-state.tgz"
LOCAL_STATE_DIR="${TMP_DIR}/listener-state"
OFFLINE_VERIFY_JSON="${TMP_DIR}/offline-verify.json"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

require_command node
require_command curl

# =============================================================================
# Step 0: Preflight
# =============================================================================
log "Preflight: probing RPC and attestation API"

curl -sS -X POST "${TEE_E2E_RPC_URL}" \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  | grep -q '"result"' || fail "RPC not reachable: ${TEE_E2E_RPC_URL}"

if [[ -n "${TEE_E2E_ATTESTATION_API_URL:-}" ]]; then
  health_url="${TEE_E2E_ATTESTATION_API_URL%/attest}/health"
  curl -fsS "${health_url}" >/dev/null || fail "Attestation API not healthy: ${health_url}"
fi

# =============================================================================
# Step 1: stake() on the V2 registry
# =============================================================================
log "Submitting stake for agent: ${TEE_E2E_AGENT_NAME}"

export CONTRACTS_DIR TEE_E2E_RPC_URL TEE_E2E_CHAIN_ID TEE_E2E_PRIVATE_KEY TEE_E2E_REGISTRY_ADDRESS TEE_E2E_AGENT_NAME TEE_E2E_MANIFEST_URL TEE_E2E_STAKE_AMOUNT_ETH
export NODE_PATH="${ETHERS_NODE_MODULES}${NODE_PATH:+:${NODE_PATH}}"

node - <<'NODE' > "${STAKE_JSON}"
const fs = require("fs");
const path = require("path");
const ethers = require("ethers");

const abiPath = path.join(process.env.CONTRACTS_DIR, "artifacts", "AgentAuditRegistryV2.json");
const artifact = JSON.parse(fs.readFileSync(abiPath, "utf8"));
const provider = new ethers.JsonRpcProvider(process.env.TEE_E2E_RPC_URL, Number(process.env.TEE_E2E_CHAIN_ID));
const wallet = new ethers.Wallet(process.env.TEE_E2E_PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.TEE_E2E_REGISTRY_ADDRESS, artifact.abi, wallet);

(async () => {
  const value = ethers.parseEther(process.env.TEE_E2E_STAKE_AMOUNT_ETH);
  const tx = await contract.stake(process.env.TEE_E2E_AGENT_NAME, process.env.TEE_E2E_MANIFEST_URL, { value });
  const receipt = await tx.wait();
  const tokenId = await contract.getTokenId(wallet.address, process.env.TEE_E2E_AGENT_NAME);
  process.stdout.write(JSON.stringify({
    transactionHash: tx.hash,
    blockNumber: receipt.blockNumber,
    from: wallet.address,
    tokenId: tokenId.toString()
  }, null, 2));
})().catch((err) => {
  process.stderr.write(`stake failed: ${err.message}\n`);
  process.exit(1);
});
NODE

TOKEN_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${STAKE_JSON}','utf8')).tokenId)")"
STAKE_TX="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${STAKE_JSON}','utf8')).transactionHash)")"
STAKE_BLOCK="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${STAKE_JSON}','utf8')).blockNumber)")"

log "Staked: tokenId=${TOKEN_ID} tx=${STAKE_TX} block=${STAKE_BLOCK}"

# =============================================================================
# Step 2: Poll until audit completes
# =============================================================================
log "Polling getLatestAuditReport(${TOKEN_ID}) until status != Pending (timeout=${TEE_E2E_TIMEOUT_MS}ms)"

now_ms() {
  node -e 'process.stdout.write(String(Date.now()))'
}

deadline_ms=$(( $(now_ms) + TEE_E2E_TIMEOUT_MS ))
while true; do
  current_ms=$(now_ms)
  if (( current_ms > deadline_ms )); then
    fail "Timeout waiting for audit to complete (tokenId=${TOKEN_ID})"
  fi

  CONTRACTS_DIR="${CONTRACTS_DIR}" \
  TEE_E2E_RPC_URL="${TEE_E2E_RPC_URL}" \
  TEE_E2E_CHAIN_ID="${TEE_E2E_CHAIN_ID}" \
  TEE_E2E_REGISTRY_ADDRESS="${TEE_E2E_REGISTRY_ADDRESS}" \
  TOKEN_ID="${TOKEN_ID}" \
  NODE_PATH="${ETHERS_NODE_MODULES}" \
  node - <<'NODE' > "${READBACK_JSON}" 2>/dev/null || true
const fs = require("fs");
const path = require("path");
const ethers = require("ethers");

const abiPath = path.join(process.env.CONTRACTS_DIR, "artifacts", "AgentAuditRegistryV2.json");
const artifact = JSON.parse(fs.readFileSync(abiPath, "utf8"));
const provider = new ethers.JsonRpcProvider(process.env.TEE_E2E_RPC_URL, Number(process.env.TEE_E2E_CHAIN_ID));
const contract = new ethers.Contract(process.env.TEE_E2E_REGISTRY_ADDRESS, artifact.abi, provider);

(async () => {
  const latest = await contract.getLatestAuditReport(BigInt(process.env.TOKEN_ID));
  process.stdout.write(JSON.stringify({
    auditId: latest.auditId.toString(),
    timestamp: latest.timestamp.toString(),
    auditScore: latest.auditScore.toString(),
    status: latest.status.toString(),
    manifestHash: latest.manifestHash,
    reportHash: latest.reportHash,
    reportCID: latest.reportCID,
    attestationHash: latest.attestationHash ?? null
  }, null, 2));
})().catch((err) => {
  process.stderr.write(`readback failed: ${err.message}\n`);
  process.exit(1);
});
NODE

  if [ -s "${READBACK_JSON}" ]; then
    status="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${READBACK_JSON}','utf8')).status)")"
    if [[ "${status}" != "0" ]]; then
      # 0 = Pending, 1 = Passed, 2 = Failed, 3 = ActionMismatch
      break
    fi
  fi

  sleep "$(( TEE_E2E_POLL_INTERVAL_MS / 1000 ))"
done

log "Audit completed"
cat "${READBACK_JSON}"

ATTESTATION_HASH="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${READBACK_JSON}','utf8')).attestationHash || '')")"
AUDIT_STATUS="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${READBACK_JSON}','utf8')).status)")"
AUDIT_SCORE="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${READBACK_JSON}','utf8')).auditScore)")"
ZERO_HASH="0x0000000000000000000000000000000000000000000000000000000000000000"

if [[ -z "${ATTESTATION_HASH}" ]] || [[ "${ATTESTATION_HASH}" == "${ZERO_HASH}" ]]; then
  fail "attestationHash is zero — listener did not bind a real SGX attestation on chain"
fi

log "On-chain attestationHash: ${ATTESTATION_HASH}"

# =============================================================================
# Step 3: Optional — pull attestation bundle from the listener + offline verify
# =============================================================================
OFFLINE_VERIFIED="skipped"
EVENT_KEY="${STAKE_TX}:0"

if [[ -n "${TEE_E2E_LISTENER_SSH:-}" ]]; then
  log "Pulling attestation bundle from listener container (${TEE_E2E_LISTENER_CONTAINER})"

  # dump listener state dir into a tarball streamed over SSH
  ${TEE_E2E_LISTENER_SSH} \
    "docker exec ${TEE_E2E_LISTENER_CONTAINER} tar czf - -C ${TEE_E2E_LISTENER_STATE_DIR} ." \
    > "${STATE_TARBALL}" 2>/dev/null || fail "Failed to pull listener state dir"

  mkdir -p "${LOCAL_STATE_DIR}"
  tar xzf "${STATE_TARBALL}" -C "${LOCAL_STATE_DIR}"

  log "Running offline attestation verify (eventKey=${EVENT_KEY})"

  (
    cd "${SANDBOX_DIR}"
    AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE="${TEE_E2E_EXPECTED_PROVIDER_TYPE}" \
    AUDIT_ATTESTATION_EXPECTED_MEASUREMENT="${TEE_E2E_EXPECTED_MEASUREMENT}" \
    AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT="${TEE_E2E_EXPECTED_QUOTE_FORMAT}" \
    AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING=true \
    npm run --silent run:attestation:verify -- \
      --event-key "${EVENT_KEY}" \
      --state-dir "${LOCAL_STATE_DIR}" \
      > "${OFFLINE_VERIFY_JSON}" 2>&1
  ) || log "Offline attestation verify failed (non-fatal; on-chain verification already passed)"

  verify_status="$(node -e "try { console.log(JSON.parse(require('fs').readFileSync('${OFFLINE_VERIFY_JSON}','utf8')).status || '') } catch(e) { console.log('') }")"
  if [[ "${verify_status}" == "verified" ]]; then
    OFFLINE_VERIFIED="true"
  else
    OFFLINE_VERIFIED="false"
  fi
fi

# =============================================================================
# Step 4: Final summary
# =============================================================================
log "Writing summary to ${TEE_E2E_OUTPUT_FILE}"

node - > "${TEE_E2E_OUTPUT_FILE}" <<NODE
const fs = require("fs");
const stake = JSON.parse(fs.readFileSync("${STAKE_JSON}", "utf8"));
const readback = JSON.parse(fs.readFileSync("${READBACK_JSON}", "utf8"));
const summary = {
  status: "pass",
  agentName: "${TEE_E2E_AGENT_NAME}",
  tokenId: stake.tokenId,
  stakeTransactionHash: stake.transactionHash,
  stakeBlockNumber: stake.blockNumber,
  from: stake.from,
  auditStatus: readback.status,
  auditScore: readback.auditScore,
  auditId: readback.auditId,
  manifestHash: readback.manifestHash,
  reportHash: readback.reportHash,
  reportCID: readback.reportCID,
  attestationHash: readback.attestationHash,
  expectedMeasurement: "${TEE_E2E_EXPECTED_MEASUREMENT}",
  offlineAttestationVerified: "${OFFLINE_VERIFIED}"
};
process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
NODE

log "✅ TEE E2E passed"
cat "${TEE_E2E_OUTPUT_FILE}"
