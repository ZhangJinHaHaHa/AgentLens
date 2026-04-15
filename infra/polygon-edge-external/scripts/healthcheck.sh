#!/bin/sh
set -eu

response="$(
  wget -qO- \
    --header='Content-Type: application/json' \
    --post-data='{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    http://127.0.0.1:8545
)"

printf "%s" "${response}" | grep -Eq '"result":"0x[0-9a-fA-F]+"'
