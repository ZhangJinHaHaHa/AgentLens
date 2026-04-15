#!/usr/bin/env bash
# setup-sgx-env.sh — Automated SGX environment setup for Tencent M6ce (Ubuntu 22.04)
#
# This script installs Intel SGX PSW, DCAP libraries, Gramine, and Node.js,
# then configures Intel PCS direct access (for regions without Tencent PCCS).
#
# Usage:
#   chmod +x setup-sgx-env.sh
#   sudo ./setup-sgx-env.sh
#
# After running this script:
#   1. Log out and back in (for sgx group membership)
#   2. Verify: is-sgx-available
#   3. Build the quote generator: cd ~/agent-shenji-sgx && make SGX=1
set -euo pipefail

log() { printf '\n=== %s ===\n' "$1"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: This script must be run as root (sudo)." >&2
  exit 1
fi

# Detect target user (the user who invoked sudo, or ubuntu as fallback)
TARGET_USER="${SUDO_USER:-ubuntu}"

# ---------- Step 1.1: Intel SGX APT source ----------
log "Adding Intel SGX APT source"

mkdir -p /etc/apt/keyrings
curl -fsSL https://download.01.org/intel-sgx/sgx_repo/ubuntu/intel-sgx-deb.key \
  | tee /etc/apt/keyrings/intel-sgx-keyring.asc > /dev/null

echo 'deb [signed-by=/etc/apt/keyrings/intel-sgx-keyring.asc arch=amd64] https://download.01.org/intel-sgx/sgx_repo/ubuntu jammy main' \
  | tee /etc/apt/sources.list.d/intel-sgx.list

apt-get update -y

# ---------- Step 1.2: SGX PSW + DCAP packages ----------
log "Installing SGX PSW runtime"

apt-get install -y \
  sgx-aesm-service \
  libsgx-enclave-common \
  libsgx-quote-ex \
  libsgx-aesm-ecdsa-plugin \
  libsgx-aesm-quote-ex-plugin

log "Installing DCAP libraries"

apt-get install -y \
  libsgx-dcap-ql \
  libsgx-dcap-ql-dev \
  libsgx-dcap-quote-verify \
  libsgx-dcap-quote-verify-dev \
  libsgx-dcap-default-qpl \
  libsgx-ae-qe3 \
  libsgx-ae-pce

log "Installing SGX development headers"

apt-get install -y \
  libsgx-enclave-common-dev

# ---------- Step 1.3: Intel PCS direct access ----------
log "Configuring Intel PCS direct access (bypasses Tencent PCCS)"

cat > /etc/sgx_default_qcnl.conf << 'QCNL_EOF'
{
  "pccs_url": "https://api.trustedservices.intel.com/sgx/certification/v4/",
  "use_secure_cert": true,
  "collateral_service": "https://api.trustedservices.intel.com/sgx/certification/v4/",
  "retry_times": 6,
  "retry_delay": 10,
  "local_pck_url": "",
  "pck_cache_expire_hours": 168
}
QCNL_EOF

# ---------- Step 1.4: AESM service ----------
log "Starting AESM service"

usermod -aG sgx "$TARGET_USER" 2>/dev/null || true

systemctl start aesmd
systemctl enable aesmd

echo "AESM service status:"
systemctl status aesmd --no-pager || true

echo ""
echo "SGX device nodes:"
ls -la /dev/sgx_enclave /dev/sgx_provision 2>/dev/null || echo "WARNING: SGX device nodes not found"

# ---------- Step 1.5: Gramine ----------
log "Installing Gramine"

curl -fsSLo /usr/share/keyrings/gramine-keyring.gpg \
  https://packages.gramineproject.io/gramine-keyring.gpg

echo "deb [arch=amd64 signed-by=/usr/share/keyrings/gramine-keyring.gpg] https://packages.gramineproject.io/ jammy main" \
  | tee /etc/apt/sources.list.d/gramine.list

apt-get update -y
apt-get install -y gramine

echo "Gramine version:"
gramine-sgx-sigstruct-view --help 2>&1 | head -1 || true

echo "SGX availability check:"
is-sgx-available 2>&1 || true

# ---------- Step 1.6: Node.js 20 ----------
log "Installing Node.js 20"

if command -v node &> /dev/null; then
  echo "Node.js already installed: $(node -v)"
else
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  echo "Node.js installed: $(node -v)"
fi

# ---------- Step 1.7: Python 3 (for generate-quote.py) ----------
log "Ensuring Python 3 is available"

apt-get install -y python3 python3-pip

# ---------- Done ----------
log "SGX environment setup complete"

echo ""
echo "Next steps:"
echo "  1. Log out and back in (for sgx group membership)"
echo "  2. Verify SGX: is-sgx-available"
echo "  3. Generate Gramine signing key: gramine-sgx-gen-private-key"
echo "  4. Deploy and build the quote generator:"
echo "     mkdir -p ~/agent-shenji-sgx"
echo "     # Copy generate-quote.py, generate-quote.manifest.template, Makefile"
echo "     cd ~/agent-shenji-sgx && make SGX=1"
echo "  5. Test: echo '{...}' | gramine-sgx ./generate-quote"
