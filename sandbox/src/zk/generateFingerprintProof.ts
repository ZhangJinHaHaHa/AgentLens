/**
 * 本模块为 agent 指纹电路准备私有见证：绑定 tokenId、manifest 原文哈希、镜像摘要、行为特征与开发者秘密，并生成/本地验证 Groth16 证明。
 * manifest、镜像 digest 和特征由调用方提供，developerSecret 是最敏感输入；这里只在内存中哈希并转成 BN128 域元素，调用方仍须负责秘密来源、清除和日志隔离。
 * SHA-256 拆分、Poseidon 参数顺序及行为特征编码属于电路的线格式不变量，任意重排都会改变 fingerprintHash/developerHash 并破坏旧 verifier 兼容。
 * WASM、proving key 与 verification key 是构建供应链信任边界；本层不验证 trusted setup、镜像 digest 的来源或 NFT 所有权。
 * 制品缺失、输入转换或证明失败会抛出且不产生持久化；返回的 `verified` 必须为真才可被上层视为可接受证明。
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createHash } from "crypto";

/**
 * Generates a Groth16 ZK proof binding an agent's identity fingerprint
 * to its NFT without revealing code or manifest content.
 */

export interface AgentFingerprintInput {
  tokenId: number;
  manifestContent: string;          // raw manifest JSON
  dockerImageDigest: string;        // SHA-256 of Docker image layer
  behavioralTraits: {
    hasNetworkAccess: boolean;
    requiresAuth: boolean;
    maxMemoryTier: 0 | 1 | 2;      // low / medium / high
    apiComplexity: 0 | 1 | 2;      // simple / moderate / complex
  };
  developerSecret: string;          // private key or derived secret
}

export interface FingerprintProofResult {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
  fingerprintHash: string;
  developerHash: string;
  verified: boolean;
}

const ZK_BUILD_DIR = resolve(__dirname, "../../../contracts/zk/build/AgentFingerprint");
const BN128_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

/**
 * Split a 256-bit hash into two 128-bit field elements for circom.
 */
function hashToFieldElements(hexHash: string): [string, string] {
  const clean = hexHash.startsWith("0x") ? hexHash.slice(2) : hexHash;
  const hi = BigInt("0x" + clean.slice(0, 32)) % BN128_PRIME;
  const lo = BigInt("0x" + clean.slice(32, 64)) % BN128_PRIME;
  return [hi.toString(), lo.toString()];
}

function sha256hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function generateFingerprintProof(
  input: AgentFingerprintInput
): Promise<FingerprintProofResult> {
  const snarkjs = await import("snarkjs");

  const wasmPath = resolve(ZK_BUILD_DIR, "AgentFingerprint_js/AgentFingerprint.wasm");
  const zkeyPath = resolve(ZK_BUILD_DIR, "proving_key.zkey");
  const vkeyPath = resolve(ZK_BUILD_DIR, "verification_key.json");

  if (!existsSync(wasmPath)) {
    throw new Error(`WASM not found: ${wasmPath}. Run 'npm run compile' in contracts/zk/ first.`);
  }

  // Compute content hashes
  const manifestHash = sha256hex(input.manifestContent);
  const manifestFields = hashToFieldElements(manifestHash);
  const codeFields = hashToFieldElements(input.dockerImageDigest);

  const traits = [
    input.behavioralTraits.hasNetworkAccess ? 1 : 0,
    input.behavioralTraits.requiresAuth ? 1 : 0,
    input.behavioralTraits.maxMemoryTier,
    input.behavioralTraits.apiComplexity
  ];

  // Compute developerSecret as a field element
  const devSecretHash = sha256hex(input.developerSecret);
  const devSecret = (BigInt("0x" + devSecretHash) % BN128_PRIME).toString();

  // Pre-compute expected hashes using Poseidon
  const poseidon = await snarkjs.buildPoseidon();

  // fingerprintHash = Poseidon(manifestHash[0..1], codeHash[0..1], traits[0..3], tokenId)
  const fpInputs = [
    ...manifestFields.map(BigInt),
    ...codeFields.map(BigInt),
    ...traits.map(BigInt),
    BigInt(input.tokenId)
  ];
  const fingerprintHash = poseidon.F.toString(poseidon(fpInputs));

  // developerHash = Poseidon(developerSecret, tokenId)
  const developerHash = poseidon.F.toString(
    poseidon([BigInt(devSecret), BigInt(input.tokenId)])
  );

  const circuitInput = {
    fingerprintHash,
    tokenId: input.tokenId,
    developerHash,
    manifestContentHash: manifestFields,
    codeHash: codeFields,
    behavioralTraits: traits,
    developerSecret: devSecret
  };

  // Generate proof
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInput,
    wasmPath,
    zkeyPath
  );

  // Verify locally
  const vkey = JSON.parse(readFileSync(vkeyPath, "utf8"));
  const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);

  return {
    proof,
    publicSignals,
    fingerprintHash,
    developerHash,
    verified
  };
}
