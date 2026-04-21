#!/usr/bin/env bash
# Compile circom circuits → R1CS + WASM + generate Groth16 verifier contracts
#
# Prerequisites:
#   - circom >= 2.1.6 (install: cargo install circom)
#   - snarkjs (npm install -g snarkjs)
#   - Node.js 20+
#   - circomlib (npm install circomlib)
#
# Usage:
#   cd contracts/zk && bash scripts/compile-circuits.sh
#
# Outputs:
#   build/<circuit>/
#     *.r1cs          — constraint system
#     *_js/           — WASM witness generator
#     *.sym           — symbol table
#     verification_key.json
#     proving_key.zkey
#   ../src/
#     AuditScoreVerifier_Groth16.sol
#     AgentFingerprintVerifier_Groth16.sol

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZK_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$ZK_DIR/build"
CIRCUITS_DIR="$ZK_DIR/circuits"
CONTRACTS_SRC="$ZK_DIR/../src"

# Check prerequisites
command -v circom >/dev/null 2>&1 || { echo "ERROR: circom not found. Install: cargo install circom"; exit 1; }
command -v snarkjs >/dev/null 2>&1 || { echo "ERROR: snarkjs not found. Install: npm install -g snarkjs"; exit 1; }

# Ensure circomlib is available
if [ ! -d "$ZK_DIR/node_modules/circomlib" ]; then
  echo "Installing circomlib..."
  cd "$ZK_DIR" && npm install circomlib
fi

# Powers of Tau ceremony (reuse if exists)
PTAU_FILE="$BUILD_DIR/pot16_final.ptau"
if [ ! -f "$PTAU_FILE" ]; then
  echo "=== Running Powers of Tau ceremony (2^14) ==="
  mkdir -p "$BUILD_DIR"
  snarkjs powersoftau new bn128 14 "$BUILD_DIR/pot16_0000.ptau" -v
  snarkjs powersoftau contribute "$BUILD_DIR/pot16_0000.ptau" "$BUILD_DIR/pot16_0001.ptau" \
    --name="Agent Shenji contribution" -v -e="$(head -c 64 /dev/urandom | xxd -p -c 128)"
  snarkjs powersoftau prepare phase2 "$BUILD_DIR/pot16_0001.ptau" "$PTAU_FILE" -v
  rm -f "$BUILD_DIR/pot16_0000.ptau" "$BUILD_DIR/pot16_0001.ptau"
  echo "=== Powers of Tau complete ==="
fi

compile_circuit() {
  local CIRCUIT_NAME="$1"
  local CIRCUIT_FILE="$CIRCUITS_DIR/$CIRCUIT_NAME.circom"
  local OUT_DIR="$BUILD_DIR/$CIRCUIT_NAME"

  echo ""
  echo "=== Compiling $CIRCUIT_NAME ==="

  mkdir -p "$OUT_DIR"

  # Step 1: Compile circom → R1CS + WASM
  circom "$CIRCUIT_FILE" \
    --r1cs --wasm --sym \
    -o "$OUT_DIR" \
    -l "$ZK_DIR/node_modules"

  echo "Constraints: $(snarkjs r1cs info "$OUT_DIR/$CIRCUIT_NAME.r1cs" 2>&1 | grep 'Constraints' || true)"

  # Step 2: Generate proving key (Groth16 setup)
  snarkjs groth16 setup \
    "$OUT_DIR/$CIRCUIT_NAME.r1cs" \
    "$PTAU_FILE" \
    "$OUT_DIR/${CIRCUIT_NAME}_0000.zkey"

  # Step 3: Contribute to phase 2
  snarkjs zkey contribute \
    "$OUT_DIR/${CIRCUIT_NAME}_0000.zkey" \
    "$OUT_DIR/${CIRCUIT_NAME}_final.zkey" \
    --name="Agent Shenji $CIRCUIT_NAME" \
    -e="$(head -c 64 /dev/urandom | xxd -p -c 128)"

  rm -f "$OUT_DIR/${CIRCUIT_NAME}_0000.zkey"
  mv "$OUT_DIR/${CIRCUIT_NAME}_final.zkey" "$OUT_DIR/proving_key.zkey"

  # Step 4: Export verification key
  snarkjs zkey export verificationkey \
    "$OUT_DIR/proving_key.zkey" \
    "$OUT_DIR/verification_key.json"

  # Step 5: Generate Solidity verifier contract
  local SOL_NAME="${CIRCUIT_NAME}Verifier_Groth16.sol"
  snarkjs zkey export solidityverifier \
    "$OUT_DIR/proving_key.zkey" \
    "$CONTRACTS_SRC/$SOL_NAME"

  echo "=== $CIRCUIT_NAME compiled ==="
  echo "  R1CS:          $OUT_DIR/$CIRCUIT_NAME.r1cs"
  echo "  WASM:          $OUT_DIR/${CIRCUIT_NAME}_js/"
  echo "  Proving key:   $OUT_DIR/proving_key.zkey"
  echo "  Verify key:    $OUT_DIR/verification_key.json"
  echo "  Solidity:      $CONTRACTS_SRC/$SOL_NAME"
}

# Compile both circuits
compile_circuit "AuditScoreVerifier"
compile_circuit "AgentFingerprint"

echo ""
echo "=== All circuits compiled successfully ==="
echo ""
echo "Next steps:"
echo "  1. Deploy verifier contracts from contracts/src/*_Groth16.sol"
echo "  2. Use build/<circuit>/proving_key.zkey + *_js/ for proof generation"
echo "  3. Verify proofs on-chain via the deployed verifier"
