pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

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

component main {public [fingerprintHash, tokenId, developerHash]} = AgentFingerprint();
