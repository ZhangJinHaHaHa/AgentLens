// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice 评价登记表所需的最小市场接口；返回值完全信任目标地址对当前区块访问权的判断。
/// @dev 构造时传入错误链、错误合约或不兼容实现会导致授权误判或 ABI 调用回滚，本接口不提供身份或代码哈希校验。
interface IAgentMarketplace {
    function hasAccess(uint256 tokenId, address user) external view returns (bool);
}

/// @title 付费访问者的一次性六维 Agent 评价登记表
/// @notice 仅允许市场当前判定有权访问的账户，对每个 tokenId 提交一组六档三值评价和链下评论摘要，并计算逐维好评/中评比例。
/// @dev `submitReview` 先跨合约调用 marketplace；该外部返回值是授权信任边界。提交成功后即永久保留，即使租期随后过期也不会撤销评价。
/// @dev 去重键是 tokenId 与 reviewer，保证同一地址对同一 token 终身最多一条；reviewId 则是全合约递增，不等同于某 token 数组索引。
/// @dev 六个 rating 只允许 0/1/2；`commentHash` 按约定是链下评论的 SHA-256，但链上不验证算法、原文、内容可用性或作者签名。
/// @dev 分布结果以 10000 为分母向下取整，只显式返回 Good 与 Neutral，Bad 可由总数推导；零评价返回全零数组而不报错。
/// @dev marketplace 地址和 owner 在当前版本没有更新入口，部署后替换市场只能发布新合约；外部授权调用失败、重复评价、非法评分或索引越界都会回滚。
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

    /// @notice 在实时访问校验通过后追加一条不可修改的六维评价。
    /// @dev 调用方应在链下先固定评论规范并计算哈希；本函数的成功输出是状态记录与 `ReviewSubmitted` 事件，不返回评论内容或聚合值。
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
    /// @dev 每个比例执行整数除法并向下取整，六个维度都以该 token 的全部评价数为共同分母。
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
