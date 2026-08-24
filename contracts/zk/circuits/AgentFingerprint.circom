pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/*
 * 中文证明契约：证明者输入 manifest/code 的两个域元素分片、四项行为特征和 developerSecret；验证者公开看到 fingerprintHash、tokenId、developerHash。
 * 约束保证两项二值特征属于 {0,1}、两项三值特征属于 {0,1,2}，并保证公开哈希分别等于固定顺序 Poseidon(9) 与 Poseidon(2) 的输出。
 * 隐私边界仅隐藏 witness 值，不证明链下材料真实：电路没有执行 SHA-256、解析 manifest、检查镜像或把 developerHash 对应到 EVM msg.sender，规范化与取样可信度由生成 witness 的系统负责。
 * tokenId 同时进入指纹哈希和开发者秘密哈希，防止同一 witness 在不同 token 间直接复用；但 token 是否存在、归谁所有仍须由链上身份合约或调用方另行验证。
 * witness 不满足取值集合或任一公开哈希等式时无法生成有效证明；所有信号按 BN254 标量域解释，链下拆分规则必须避免把不同字节串映射成意外等价的域元素。
 * `main` 的公开输入顺序必须保持 `[fingerprintHash, tokenId, developerHash]`，与 snarkjs 生成的三输入 verifier 及 `ZkAuditVerifier.verifyFingerprint` 完全一致。
 * Poseidon 参数和约束语义来自安装的 circomlib；升级 circom/circomlib 或重新 setup 会改变 R1CS/密钥/verifier 配套关系，旧证明不能假定继续兼容。
 */
/*
 * AgentFingerprint — ZK proof binding an agent's identity to its NFT
 * without revealing the actual code or manifest content.
 *
 * The developer can prove "I own the agent behind this NFT" and
 * "this agent has specific behavioral properties" without exposing
 * the agent's source code or internal configuration.
 *
 * Public inputs:
 *   - fingerprintHash: the on-chain fingerprint (Poseidon hash)
 *   - tokenId: the NFT token ID this fingerprint is bound to
 *   - developerHash: hash of developer address (binding)
 *
 * Private inputs:
 *   - manifestContentHash: SHA-256 of the agent's manifest.json (as field elements)
 *   - codeHash: SHA-256 of the agent's Docker image layer digest
 *   - behavioralTraits[4]: declared behavioral properties
 *     [0] = hasNetworkAccess (0 or 1)
 *     [1] = requiresAuth (0 or 1)
 *     [2] = maxMemoryTier (0=low, 1=medium, 2=high)
 *     [3] = apiComplexity (0=simple, 1=moderate, 2=complex)
 *   - developerSecret: private key derivative (proves ownership)
 *
 * The circuit verifies:
 *   1. fingerprintHash = Poseidon(manifestContentHash, codeHash, behavioralTraits..., tokenId)
 *   2. developerHash = Poseidon(developerSecret, tokenId)
 *   3. behavioralTraits are within valid ranges
 *   4. All inputs are properly bound to the specific tokenId
 */

/*
 * BinaryCheck: Verify a signal is 0 or 1
 */
template BinaryCheck() {
    signal input value;
    value * (1 - value) === 0;
}

/*
 * TernaryCheck: Verify a signal is 0, 1, or 2
 */
template TernaryCheck() {
    signal input value;
    // value * (value - 1) * (value - 2) === 0
    signal t1;
    t1 <== value * (value - 1);
    signal t2;
    t2 <== t1 * (value - 2);
    t2 === 0;
}

/*
 * Main circuit: AgentFingerprint
 */
template AgentFingerprint() {
    // Public inputs
    signal input fingerprintHash;
    signal input tokenId;
    signal input developerHash;

    // Private inputs
    signal input manifestContentHash[2]; // SHA-256 split into 2 field elements (128-bit each)
    signal input codeHash[2];            // SHA-256 split into 2 field elements
    signal input behavioralTraits[4];
    signal input developerSecret;

    // --- Step 1: Verify behavioral traits are in valid ranges ---

    // traits[0]: hasNetworkAccess — binary
    component binCheck0 = BinaryCheck();
    binCheck0.value <== behavioralTraits[0];

    // traits[1]: requiresAuth — binary
    component binCheck1 = BinaryCheck();
    binCheck1.value <== behavioralTraits[1];

    // traits[2]: maxMemoryTier — ternary (0, 1, 2)
    component terCheck0 = TernaryCheck();
    terCheck0.value <== behavioralTraits[2];

    // traits[3]: apiComplexity — ternary (0, 1, 2)
    component terCheck1 = TernaryCheck();
    terCheck1.value <== behavioralTraits[3];

    // --- Step 2: Compute fingerprint hash ---
    // fingerprintHash = Poseidon(manifestHash[0..1], codeHash[0..1], traits[0..3], tokenId)
    // Total: 9 inputs
    component fpHash = Poseidon(9);
    fpHash.inputs[0] <== manifestContentHash[0];
    fpHash.inputs[1] <== manifestContentHash[1];
    fpHash.inputs[2] <== codeHash[0];
    fpHash.inputs[3] <== codeHash[1];
    fpHash.inputs[4] <== behavioralTraits[0];
    fpHash.inputs[5] <== behavioralTraits[1];
    fpHash.inputs[6] <== behavioralTraits[2];
    fpHash.inputs[7] <== behavioralTraits[3];
    fpHash.inputs[8] <== tokenId;

    // Constrain: computed hash == public fingerprintHash
    fpHash.out === fingerprintHash;

    // --- Step 3: Verify developer ownership ---
    // developerHash = Poseidon(developerSecret, tokenId)
    component devHash = Poseidon(2);
    devHash.inputs[0] <== developerSecret;
    devHash.inputs[1] <== tokenId;

    // Constrain: computed developer hash == public developerHash
    devHash.out === developerHash;
}

// 这是生成 verifier ABI 的顺序源；调整 public 列表必须同步更新 Solidity 包装层的 `uint256[3]` 编码。
component main {public [fingerprintHash, tokenId, developerHash]} = AgentFingerprint();
