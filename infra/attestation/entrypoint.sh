#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# attestation-entrypoint.sh
#
# Runs inside the shenji-attestation-api container on boot.
#   1. Ensures a persistent Gramine enclave signing key exists (stable MRENCLAVE
#      across container restarts when bind-mounted to /root/.config/gramine).
#   2. Builds generate-quote.manifest.sgx + generate-quote.sig if absent or
#      stale (keyed on generate-quote.py mtime).
#   3. Prints the MRENCLAVE so operators can pin it into verifier policy.
#   4. Execs the attestation API server.
# ------------------------------------------------------------------------------
set -euo pipefail

log() { printf '[attestation-entrypoint] %s\n' "$*"; }

SGX_WORKDIR=${SGX_WORKDIR:-/app/sgx}
GRAMINE_KEY_DIR=${GRAMINE_KEY_DIR:-/root/.config/gramine}
GRAMINE_KEY_PATH="${GRAMINE_KEY_DIR}/enclave-key.pem"

cd "${SGX_WORKDIR}"

# 1. Enclave signing key -------------------------------------------------------
mkdir -p "${GRAMINE_KEY_DIR}"
if [ ! -f "${GRAMINE_KEY_PATH}" ]; then
  log "No enclave signing key at ${GRAMINE_KEY_PATH}; generating a new one."
  gramine-sgx-gen-private-key
fi

# 2. Build SGX manifest --------------------------------------------------------
if [ ! -f generate-quote.manifest.sgx ] \
   || [ generate-quote.py -nt generate-quote.manifest.sgx ] \
   || [ generate-quote.manifest.template -nt generate-quote.manifest.sgx ]; then
  log "Building generate-quote.manifest.sgx via 'make SGX=1' (first boot or source change)."
  make SGX=1
else
  log "generate-quote.manifest.sgx is up to date; skipping build."
fi

# 3. Report MRENCLAVE ----------------------------------------------------------
if command -v gramine-sgx-sigstruct-view >/dev/null 2>&1; then
  MRENCLAVE=$(gramine-sgx-sigstruct-view generate-quote.sig 2>/dev/null \
              | awk '/mr_enclave/ { print $2; exit }' || true)
  if [ -n "${MRENCLAVE:-}" ]; then
    log "MRENCLAVE=${MRENCLAVE}"
    log "Pin this value in listener env as AUDIT_ATTESTATION_EXPECTED_MEASUREMENT."
  else
    log "WARNING: gramine-sgx-sigstruct-view did not return mr_enclave; check manifest."
  fi
else
  log "WARNING: gramine-sgx-sigstruct-view not found; MRENCLAVE unknown."
fi

# 4. Launch the attestation API server -----------------------------------------
log "Starting attestation API on ${AUDIT_ATTESTATION_SERVICE_HOST:-0.0.0.0}:${AUDIT_ATTESTATION_SERVICE_PORT:-3311} (mode=${AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE:-unset})."
exec node /app/sandbox/dist/src/cli/attestationApi.js
