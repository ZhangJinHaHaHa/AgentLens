# ==============================================================================
# Agent Shenji — Attestation API Service
#
# Runs inside an SGX-capable host (Tencent Cloud M6ce). The container ships:
#   * Gramine + Intel SGX DCAP client libraries (glibc / Ubuntu 22.04)
#   * Node.js 20 runtime for the attestation API server
#   * Python 3 + the Gramine-enclave generate-quote.py script
#
# Request flow:
#   client (listener)
#     --HTTP POST /attest {eventKey, tokenId, manifestHash, evidenceRoot}--> API
#     --spawn `gramine-sgx ./generate-quote` with JSON on stdin -----------> enclave
#     <-- JSON {measurement, quote, quoteFormat, sessionPublicKey} --------- enclave
#   <------ HTTP 200 JSON with the DCAP v3 quote --------------------------- API
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build the sandbox TypeScript sources into dist/
# ------------------------------------------------------------------------------
FROM node:20-slim AS node-builder

WORKDIR /app

COPY sandbox/package.json sandbox/package-lock.json* ./sandbox/
RUN cd sandbox && npm ci --ignore-scripts

COPY contracts/artifacts/ ./contracts/artifacts/
COPY sandbox/tsconfig.json ./sandbox/
COPY sandbox/src/ ./sandbox/src/

RUN cd sandbox && npm run build

# ------------------------------------------------------------------------------
# Stage 2: Runtime image = Gramine + Node.js + Python 3
# ------------------------------------------------------------------------------
FROM gramineproject/gramine:stable-jammy AS runtime

# Install Node.js 20, Python 3, curl (health probes) and tini (init).
# gramineproject/gramine already ships Ubuntu 22.04 glibc + Gramine SDK.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      gnupg \
      python3 \
      python3-pip \
      tini \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Compiled Node.js output from stage 1
COPY --from=node-builder /app/sandbox/dist ./sandbox/dist
COPY --from=node-builder /app/sandbox/node_modules ./sandbox/node_modules
COPY --from=node-builder /app/sandbox/package.json ./sandbox/package.json
COPY --from=node-builder /app/contracts/artifacts ./contracts/artifacts

# Gramine enclave sources (Python script + manifest template + Makefile)
COPY sandbox/sgx/ /app/sgx/

# Entrypoint: on first boot, generate enclave signing key (if absent) and
# produce generate-quote.manifest.sgx via `make SGX=1`, then launch the API.
COPY infra/attestation/entrypoint.sh /usr/local/bin/attestation-entrypoint.sh
RUN chmod +x /usr/local/bin/attestation-entrypoint.sh

EXPOSE 3311

ENTRYPOINT ["tini", "--", "/usr/local/bin/attestation-entrypoint.sh"]
