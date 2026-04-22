import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Generates a Groth16 ZK proof that dimensional scores were correctly
 * computed from raw evaluation data.
 *
 * Uses snarkjs to generate the proof using the compiled circuit's
 * WASM witness generator and proving key.
 */

export interface AuditScoreProofInput {
  dimensionalScores: readonly [number, number, number, number, number, number];
  overallScore: number;
  categoryScores: number[][];   // [6][MAX_QUESTIONS], padded with 0s
  categoryCounts: number[];     // [6]
  cpuAvgMilli: number;
  memoryPeakMb: number;
  complianceScore: number;
  securityBoundaryScore: number;
}

export interface ZkProofResult {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
  inputCommitment: string;
  verified: boolean;
}

const MAX_QUESTIONS = 10;

const ZK_BUILD_DIR = resolve(__dirname, "../../../contracts/zk/build/AuditScoreVerifier");

function padArray(arr: number[], length: number): number[] {
  const result = [...arr];
  while (result.length < length) {
    result.push(0);
  }
  return result.slice(0, length);
}

export async function generateAuditScoreProof(
  input: AuditScoreProofInput
): Promise<ZkProofResult> {
  // Dynamic import of snarkjs (ESM module)
  const snarkjs = await import("snarkjs");

  const wasmPath = resolve(ZK_BUILD_DIR, "AuditScoreVerifier_js/AuditScoreVerifier.wasm");
  const zkeyPath = resolve(ZK_BUILD_DIR, "proving_key.zkey");
  const vkeyPath = resolve(ZK_BUILD_DIR, "verification_key.json");

  if (!existsSync(wasmPath)) {
    throw new Error(`WASM not found: ${wasmPath}. Run 'npm run compile' in contracts/zk/ first.`);
  }

  if (!existsSync(zkeyPath)) {
    throw new Error(`Proving key not found: ${zkeyPath}. Run 'npm run compile' in contracts/zk/ first.`);
  }

  // Prepare circuit inputs
  const categoryScoresPadded = input.categoryScores.map(
    (scores) => padArray(scores, MAX_QUESTIONS)
  );

  // Ensure we have exactly 6 categories
  while (categoryScoresPadded.length < 6) {
    categoryScoresPadded.push(padArray([], MAX_QUESTIONS));
  }

  const circuitInput = {
    dimensionalScores: input.dimensionalScores,
    overallScore: input.overallScore,
    inputCommitment: "0", // will be computed by circuit and matched
    categoryScores: categoryScoresPadded,
    categoryCounts: padArray(input.categoryCounts, 6),
    cpuAvgMilli: input.cpuAvgMilli,
    memoryPeakMb: input.memoryPeakMb,
    complianceScore: input.complianceScore,
    securityBoundaryScore: input.securityBoundaryScore
  };

  // Step 1: Compute inputCommitment (Poseidon hash) using snarkjs
  // We need to pre-compute this so the circuit can verify it
  const poseidonInputs: bigint[] = [
    BigInt(input.categoryCounts[0] || 0),
    BigInt(input.categoryCounts[1] || 0),
    BigInt(input.categoryCounts[2] || 0),
    BigInt(input.categoryCounts[3] || 0),
    BigInt(input.cpuAvgMilli),
    BigInt(input.memoryPeakMb),
    BigInt(input.complianceScore),
    BigInt(input.securityBoundaryScore)
  ];

  const poseidon = await snarkjs.buildPoseidon();
  const commitment = poseidon.F.toString(poseidon(poseidonInputs));
  circuitInput.inputCommitment = commitment;

  // Step 2: Generate the proof
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInput,
    wasmPath,
    zkeyPath
  );

  // Step 3: Verify locally before returning
  const vkey = JSON.parse(readFileSync(vkeyPath, "utf8"));
  const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);

  return {
    proof,
    publicSignals,
    inputCommitment: commitment,
    verified
  };
}
