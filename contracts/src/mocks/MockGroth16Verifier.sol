// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockGroth16Verifier
 * @notice Test-only Groth16 verifier that accepts all proofs.
 */
contract MockGroth16Verifier {
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[8] calldata
    ) external pure returns (bool) {
        return true;
    }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[3] calldata
    ) external pure returns (bool) {
        return true;
    }
}
