#!/bin/sh
set -eu

require_env() {
  variable_name="$1"
  value="$(printenv "$variable_name" || true)"

  if [ -z "$value" ]; then
    echo "Missing required environment variable: $variable_name" >&2
    exit 1
  fi
}

parse_json_field() {
  json="$1"
  field="$2"

  printf "%s" "$json" | sed -n "s/.*\"${field}\":\"\\([^\"]*\\)\".*/\\1/p"
}

require_env EDGE_LOCAL_CHAIN_ID
require_env EDGE_LOCAL_RPC_PORT
require_env EDGE_LOCAL_DEPLOYER_PRIVATE_KEY
require_env EDGE_LOCAL_DEPLOYER_ADDRESS

DATA_DIR="/app/data"
VALIDATOR_DIR="${DATA_DIR}/validator1"
GENESIS_FILE="${DATA_DIR}/genesis.json"
SECRETS_INFO_FILE="${VALIDATOR_DIR}/secrets-init.json"
NODE_ID_FILE="${VALIDATOR_DIR}/node_id.txt"

mkdir -p "${VALIDATOR_DIR}"

if [ ! -f "${VALIDATOR_DIR}/consensus/validator.key" ]; then
  secrets_output="$(polygon-edge secrets init --data-dir "${VALIDATOR_DIR}" --insecure --json)"
  printf "%s\n" "${secrets_output}" > "${SECRETS_INFO_FILE}"
  node_id="$(parse_json_field "${secrets_output}" "node_id")"

  if [ -z "${node_id}" ]; then
    echo "Unable to parse node_id from polygon-edge secrets output" >&2
    exit 1
  fi

  printf "%s\n" "${node_id}" > "${NODE_ID_FILE}"
fi

if [ ! -f "${NODE_ID_FILE}" ]; then
  echo "Missing ${NODE_ID_FILE}. Remove local data and reinitialize the chain." >&2
  exit 1
fi

node_id="$(tr -d '\n' < "${NODE_ID_FILE}")"
bootnode="/ip4/127.0.0.1/tcp/1478/p2p/${node_id}"

if [ ! -f "${GENESIS_FILE}" ]; then
  polygon-edge genesis \
    --name "${EDGE_LOCAL_NETWORK_NAME:-polygon-edge-local}" \
    --consensus ibft \
    --ibft-validator-type bls \
    --chain-id "${EDGE_LOCAL_CHAIN_ID}" \
    --block-gas-limit "${EDGE_LOCAL_BLOCK_GAS_LIMIT:-20000000}" \
    --premine "${EDGE_LOCAL_DEPLOYER_ADDRESS}:1000000000000000000000000" \
    --bootnode "${bootnode}" \
    --validators-path "${DATA_DIR}" \
    --validators-prefix validator \
    --dir "${GENESIS_FILE}"
fi

exec polygon-edge server \
  --data-dir "${VALIDATOR_DIR}" \
  --chain "${GENESIS_FILE}" \
  --grpc-address 0.0.0.0:9632 \
  --libp2p 0.0.0.0:1478 \
  --jsonrpc 0.0.0.0:8545 \
  --access-control-allow-origins "*" \
  --seal
