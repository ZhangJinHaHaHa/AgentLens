# Attestation API — SGX Host Deployment

This directory ships the Docker image and compose file for the Agent Shenji
**attestation API service**. It runs on the SGX-capable host (Tencent Cloud
M6ce confidential-computing instance) and produces real SGX DCAP v3 quotes
bound to each audit request via `report_data = SHA-256(eventKey ‖ manifestHash ‖ evidenceRoot)`.

## Architecture

```
┌──────────────┐  HTTP POST /attest   ┌───────────────────────────┐
│  listener    │ ───────────────────▶ │ shenji-attestation-api    │
│ (prod host)  │                      │ (this compose, M6ce)      │
└──────────────┘ ◀─── JSON {quote} ── │                           │
                                      │  spawn(gramine-sgx ./     │
                                      │        generate-quote)    │
                                      │        │        ▲         │
                                      │        ▼        │         │
                                      │   Gramine enclave         │
                                      │   (/dev/sgx_enclave,      │
                                      │    /dev/sgx_provision)    │
                                      └───────────────────────────┘
```

## Prerequisites on the M6ce host

1. Intel SGX DCAP runtime installed — run `sandbox/sgx/setup-sgx-env.sh` once.
2. `/dev/sgx_enclave` and `/dev/sgx_provision` present — verify with
   `is-sgx-available`.
3. `aesmd` service running — `systemctl status aesmd`.
4. `docker` and `docker compose v2` available on the host.

## Deployment

```bash
# 1. Sync this repo to the M6ce host (rsync/scp/git clone).
# 2. Copy the env template and fill in any overrides.
cd infra/attestation
cp .env.example .env

# 3. Build + start.
docker compose build
docker compose up -d

# 4. Watch the first boot — it generates the enclave key, signs the
#    manifest, and prints the resulting MRENCLAVE.
docker compose logs -f attestation-api
```

You should see a line like:

```
[attestation-entrypoint] MRENCLAVE=5d3a...e9b4
[attestation-entrypoint] Pin this value in listener env as AUDIT_ATTESTATION_EXPECTED_MEASUREMENT.
```

Copy that MRENCLAVE into the **listener** production environment variable
`AUDIT_ATTESTATION_EXPECTED_MEASUREMENT` so the listener rejects any quote
produced by a different enclave.

## Smoke test

```bash
# Health probe.
curl -fsS http://127.0.0.1:3311/health
# → {"status":"ok"}

# End-to-end attest call (deterministic test payload).
curl -fsS -X POST http://127.0.0.1:3311/attest \
  -H 'content-type: application/json' \
  -d '{
    "schemaVersion":"audit-attestation-request.v1",
    "eventKey":"smoke-test-1",
    "tokenId":"1",
    "manifestHash":"0x0000000000000000000000000000000000000000000000000000000000000000",
    "evidenceRoot":"0x0000000000000000000000000000000000000000000000000000000000000000",
    "manifestUrl":"https://example.com/manifest.json"
  }'
```

The response should contain `measurement`, `quoteFormat`, `sessionPublicKey`,
and a hex-encoded `quote`. If you get a `400` or `500`, inspect
`docker compose logs attestation-api` — common failures are:

- Missing `/dev/sgx_enclave` → add `--device` or fix the host driver.
- AESM not running → `systemctl start aesmd`.
- DCAP collateral fetch timeout → ensure outbound HTTPS to
  `api.trustedservices.intel.com` is permitted (see
  `/etc/sgx_default_qcnl.conf`).

## Volumes

| Volume                      | Purpose                                               |
|-----------------------------|-------------------------------------------------------|
| `attestation-gramine-keys`  | Gramine enclave signing key. **Do not delete** — loss rotates MRENCLAVE. |

## Native (non-Docker) alternative

The host already has Gramine + Node installed via `setup-sgx-env.sh`. For
debugging you can skip Docker entirely:

```bash
cd /path/to/agent-shenji/sandbox
npm ci
npm run build

cd sgx && make SGX=1 && cd ..

AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE=command \
AUDIT_ATTESTATION_SERVICE_HOST=0.0.0.0 \
AUDIT_ATTESTATION_SERVICE_PORT=3311 \
AUDIT_ATTESTATION_COMMAND=gramine-sgx \
AUDIT_ATTESTATION_COMMAND_ARGS=./generate-quote \
AUDIT_ATTESTATION_COMMAND_TIMEOUT_MS=30000 \
node dist/src/cli/attestationApi.js
```

## Interop with the listener

The listener side is configured via `AUDIT_ATTESTATION_API_URL`
(`http://<m6ce-host>:3311/attest`) and optional
`AUDIT_ATTESTATION_EXPECTED_MEASUREMENT` / `AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE`
/ `AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT`. See
`infra/production/.env.example` for the full list.
