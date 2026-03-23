// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentMarketplace {
    function hasAccess(uint256 tokenId, address user) external view returns (bool);
}

contract AgentReviewRegistry {
    // Rating values: 0 = Bad, 1 = Neutral, 2 = Good
    uint8 public constant RATING_BAD = 0;
    uint8 public constant RATING_NEUTRAL = 1;
    uint8 public constant RATING_GOOD = 2;

    struct Review {
        uint64 reviewId;
        address reviewer;
        uint64 timestamp;
        uint8 securityRating;       // 0=bad, 1=neutral, 2=good
        uint8 taskExecutionRating;
        uint8 cognitiveRating;
        uint8 environmentRating;
        uint8 engineeringRating;
        uint8 complianceRating;
        bytes32 commentHash;   // SHA-256 of off-chain comment text
    }

    address public owner;
    IAgentMarketplace public marketplace;

    uint64 private _nextReviewId = 1;

    mapping(uint256 => Review[]) private _reviews;
    mapping(bytes32 => bool) private _hasReviewed; // keccak256(tokenId, reviewer) => bool

    event ReviewSubmitted(uint256 indexed tokenId, uint64 reviewId, address indexed reviewer);

    modifier onlyWithAccess(uint256 tokenId) {
        require(marketplace.hasAccess(tokenId, msg.sender), "NO_ACCESS");
        _;
    }

    constructor(address marketplaceAddress) {
        owner = msg.sender;
        marketplace = IAgentMarketplace(marketplaceAddress);
    }

    function submitReview(
        uint256 tokenId,
        uint8[6] calldata ratings,
        bytes32 commentHash
    ) external onlyWithAccess(tokenId) {
        bytes32 reviewKey = keccak256(abi.encodePacked(tokenId, msg.sender));
        require(!_hasReviewed[reviewKey], "ALREADY_REVIEWED");

        // Validate all ratings are 0, 1, or 2
        for (uint256 i = 0; i < 6; i++) {
            require(ratings[i] <= 2, "INVALID_RATING");
        }

        uint64 reviewId = _nextReviewId;
        _nextReviewId += 1;

        _reviews[tokenId].push(Review({
            reviewId: reviewId,
            reviewer: msg.sender,
            timestamp: uint64(block.timestamp),
            securityRating: ratings[0],
            taskExecutionRating: ratings[1],
            cognitiveRating: ratings[2],
            environmentRating: ratings[3],
            engineeringRating: ratings[4],
            complianceRating: ratings[5],
            commentHash: commentHash
        }));

        _hasReviewed[reviewKey] = true;

        emit ReviewSubmitted(tokenId, reviewId, msg.sender);
    }

    function getReviewCount(uint256 tokenId) external view returns (uint256) {
        return _reviews[tokenId].length;
    }

    function getReview(uint256 tokenId, uint256 index) external view returns (Review memory) {
        require(index < _reviews[tokenId].length, "INDEX_OUT_OF_BOUNDS");
        return _reviews[tokenId][index];
    }

    /// @notice Returns rating distribution for each dimension as basis points (0-10000).
    /// @return goodRatios   Percentage of "good" ratings per dimension
    /// @return neutralRatios Percentage of "neutral" ratings per dimension
    function getRatingDistribution(uint256 tokenId)
        external view returns (uint16[6] memory goodRatios, uint16[6] memory neutralRatios)
    {
        uint256 count = _reviews[tokenId].length;
        if (count == 0) return (goodRatios, neutralRatios);

        uint256[6] memory goodCounts;
        uint256[6] memory neutralCounts;

        for (uint256 i = 0; i < count; i++) {
            Review memory r = _reviews[tokenId][i];
            uint8[6] memory ratings = [
                r.securityRating, r.taskExecutionRating, r.cognitiveRating,
                r.environmentRating, r.engineeringRating, r.complianceRating
            ];
            for (uint256 j = 0; j < 6; j++) {
                if (ratings[j] == RATING_GOOD) goodCounts[j]++;
                else if (ratings[j] == RATING_NEUTRAL) neutralCounts[j]++;
            }
        }

        for (uint256 i = 0; i < 6; i++) {
            goodRatios[i] = uint16((goodCounts[i] * 10000) / count);
            neutralRatios[i] = uint16((neutralCounts[i] * 10000) / count);
        }
    }

    function hasReviewed(uint256 tokenId, address reviewer) external view returns (bool) {
        bytes32 reviewKey = keccak256(abi.encodePacked(tokenId, reviewer));
        return _hasReviewed[reviewKey];
    }
}
