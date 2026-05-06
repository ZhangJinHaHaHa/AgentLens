#!/usr/bin/env bash
# Run LLM A/B test: stake 3 agents backed by different LLMs (GPT, Zhipu, MiniMax),
# let the listener audit each, then compare scores.
#
# Prerequisites:
#   - Docker running on the server
#   - test-agent image built: cd sandbox && npm run build:test-agent
#   - Listener running
#
# Usage:
#   export GPT_API_KEY="sk-..."
#   export GPT_API_BASE_URL="https://api.jiekou.ai/openai/v1"  # optional proxy
#   export ZHIPU_API_KEY="..."
#   export MINIMAX_API_KEY="..."  # optional
#   bash infra/production/scripts/run-llm-ab-test.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RPC_URL="${RPC_URL:-http://203.91.76.159:18545}"
CONTRACT="${CONTRACT:-0x7969c5eD335650692Bc04293B07F5BF2e7A673C0}"
PRIVATE_KEY="${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
CONTRACTS_DIR="$REPO_ROOT/contracts"

echo "=== LLM A/B Test ==="
echo "RPC: $RPC_URL"
echo "Contract: $CONTRACT"
echo ""

# Build test-agent image
echo "Building test-agent Docker image..."
cd "$REPO_ROOT/sandbox"
npm run build 2>/dev/null
docker build -t agent-shenji/test-agent:local -f test-agent/Dockerfile . 2>/dev/null
echo "Image built."

# Create manifests for each LLM provider
MANIFEST_DIR="/tmp/llm-ab-manifests"
mkdir -p "$MANIFEST_DIR"

create_manifest() {
  local name="$1"
  local provider="$2"
  local api_key="$3"
  local model="$4"
  local base_url="${5:-}"
  local file="$MANIFEST_DIR/$name.json"

  cat > "$file" << MEOF
{
  "agent_name": "$name",
  "image": "agent-shenji/test-agent:local",
  "allowed_hosts": ["example.com", "api.openai.com", "open.bigmodel.cn", "api.minimax.chat"],
  "allowed_rpc_endpoints": ["http://polygon-edge-external:8545"],
  "env": {
    "AGENT_LLM_PROVIDER": "$provider",
    "AGENT_LLM_API_KEY": "$api_key",
    "AGENT_LLM_MODEL": "$model"${base_url:+,
    "AGENT_LLM_API_BASE_URL": "$base_url"}
  }
}
MEOF

  echo "Manifest: $file"
}

# Create manifests
if [ -n "${GPT_API_KEY:-}" ]; then
  create_manifest "GPT-Agent" "openai" "$GPT_API_KEY" "gpt-4o" "${GPT_API_BASE_URL:-}"
fi

if [ -n "${ZHIPU_API_KEY:-}" ]; then
  create_manifest "Zhipu-GLM-Agent" "zhipu" "$ZHIPU_API_KEY" "glm-4-flash"
fi

if [ -n "${MINIMAX_API_KEY:-}" ]; then
  create_manifest "MiniMax-Agent" "minimax" "$MINIMAX_API_KEY" "abab6.5s-chat"
fi

echo ""
echo "Manifests created. To run the test:"
echo "  1. Serve manifests via HTTP (e.g., nginx static)"
echo "  2. Stake each agent with its manifest URL"
echo "  3. Listener will auto-audit each agent"
echo ""
echo "=== Done ==="
