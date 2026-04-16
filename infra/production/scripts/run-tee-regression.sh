#!/bin/bash
set -euo pipefail

# =============================================================================
# TEE regression test: loop run-tee-e2e.sh N times, collect per-run summaries,
# and aggregate stats (success rate, median/p95 elapsed).
#
# Usage:
#   bash run-tee-regression.sh --env /path/to/tee-e2e.env --iterations 10
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

ITERATIONS=10
ENV_FILE=""
OUTPUT_DIR="${SCRIPT_DIR}/regression-$(date +%Y%m%d-%H%M%S)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_FILE="$2"; shift 2;;
    --iterations) ITERATIONS="$2"; shift 2;;
    --output-dir) OUTPUT_DIR="$2"; shift 2;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

if [[ -z "${ENV_FILE}" ]]; then
  echo "Missing --env <file>" >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"
echo "Output directory: ${OUTPUT_DIR}"

SUCCESS=0
FAILED=0
ELAPSED_MS=()

for i in $(seq 1 "${ITERATIONS}"); do
  echo ""
  echo "=== Iteration ${i}/${ITERATIONS} ==="
  start_ms="$(node -e 'process.stdout.write(String(Date.now()))')"

  run_env="${OUTPUT_DIR}/run-${i}.env"
  cp "${ENV_FILE}" "${run_env}"
  # unique agent name per iteration
  echo "TEE_E2E_AGENT_NAME=regression-$(date +%s)-${i}" >> "${run_env}"
  echo "TEE_E2E_OUTPUT_FILE=${OUTPUT_DIR}/summary-${i}.json" >> "${run_env}"

  if bash "${SCRIPT_DIR}/run-tee-e2e.sh" --env "${run_env}" > "${OUTPUT_DIR}/log-${i}.txt" 2>&1; then
    end_ms="$(node -e 'process.stdout.write(String(Date.now()))')"
    elapsed=$((end_ms - start_ms))
    ELAPSED_MS+=("${elapsed}")
    SUCCESS=$((SUCCESS + 1))
    hash="$(node -e "try { console.log(JSON.parse(require('fs').readFileSync('${OUTPUT_DIR}/summary-${i}.json','utf8')).attestationHash) } catch(e) {}")"
    echo "Iteration ${i}: ✅ pass (${elapsed}ms, attestationHash=${hash})"
  else
    end_ms="$(node -e 'process.stdout.write(String(Date.now()))')"
    elapsed=$((end_ms - start_ms))
    FAILED=$((FAILED + 1))
    echo "Iteration ${i}: ❌ fail (${elapsed}ms, see log-${i}.txt)"
  fi
done

# ---- aggregate ----
ELAPSED_JSON="[$(IFS=,; echo "${ELAPSED_MS[*]:-}")]"
node - > "${OUTPUT_DIR}/aggregate.json" <<NODE
const fs = require("fs");
const path = require("path");

const dir = "${OUTPUT_DIR}";
const summaries = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.startsWith("summary-") || !f.endsWith(".json")) continue;
  try {
    summaries.push(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  } catch (e) {}
}

const success = summaries.filter((s) => s.status === "pass" && s.attestationHash && s.attestationHash !== "0x" + "0".repeat(64));
const nonZero = summaries.filter((s) => s.attestationHash && s.attestationHash !== "0x" + "0".repeat(64));
const elapsedMs = ${ELAPSED_JSON}.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
const median = elapsedMs.length ? elapsedMs[Math.floor(elapsedMs.length / 2)] : null;
const p95 = elapsedMs.length ? elapsedMs[Math.min(elapsedMs.length - 1, Math.floor(elapsedMs.length * 0.95))] : null;

const out = {
  iterations: ${ITERATIONS},
  success: ${SUCCESS},
  failed: ${FAILED},
  successRate: ((${SUCCESS}) / ${ITERATIONS}).toFixed(2),
  attestationNonZeroCount: nonZero.length,
  elapsedMedianMs: median,
  elapsedP95Ms: p95,
  tokenIds: summaries.map((s) => s.tokenId)
};
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
NODE

echo ""
echo "=== Aggregate ==="
cat "${OUTPUT_DIR}/aggregate.json"
