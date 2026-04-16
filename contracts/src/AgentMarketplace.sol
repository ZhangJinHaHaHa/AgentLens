// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AgentMarketplace {
    struct PricingInfo {
        uint256 pricePerDay;   // rent cost per day in wei
        uint256 buyPrice;      // buy (permanent access) cost in wei
        bool configured;
    }

    struct AccessRecord {
        uint256 tokenId;
        address buyer;
        uint64 expiresAt;      // 0 = permanent purchase
        uint256 amountPaid;
        bool isRental;         // true = rental, false = purchase
    }

    address public owner;
    address public operator;

    mapping(uint256 => PricingInfo) private _pricing;
    mapping(uint256 => AccessRecord[]) private _accessRecords;
    mapping(bytes32 => bool) private _activeAccess; // keccak256(tokenId, user) => bool for permanent
    mapping(bytes32 => uint64) private _accessExpiry; // keccak256(tokenId, user) => expiresAt for rental

    event PriceSet(uint256 indexed tokenId, uint256 pricePerDay, uint256 buyPrice);
    event AccessGranted(uint256 indexed tokenId, address indexed buyer, bool isRental, uint64 expiresAt);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner, "ONLY_OPERATOR");
        _;
    }

    constructor(address initialOperator) {
        owner = msg.sender;
        operator = initialOperator == address(0) ? msg.sender : initialOperator;
    }

    function setPrice(
        uint256 tokenId,
        uint256 pricePerDay,
        uint256 buyPrice
    ) external onlyOperator {
        _pricing[tokenId] = PricingInfo({
            pricePerDay: pricePerDay,
            buyPrice: buyPrice,
            configured: true
        });
        emit PriceSet(tokenId, pricePerDay, buyPrice);
    }

    function rentAgent(uint256 tokenId, uint256 durationDays) external payable {
        PricingInfo memory pricing = _pricing[tokenId];
        require(pricing.configured, "PRICING_NOT_SET");
        require(durationDays > 0, "INVALID_DURATION");

        uint256 totalCost = pricing.pricePerDay * durationDays;
        require(msg.value >= totalCost, "INSUFFICIENT_PAYMENT");

        uint64 expiresAt = uint64(block.timestamp + durationDays * 1 days);
        bytes32 key = _accessKey(tokenId, msg.sender);

        // Extend existing rental or set new
        if (_accessExpiry[key] > block.timestamp) {
            _accessExpiry[key] = uint64(uint256(_accessExpiry[key]) + durationDays * 1 days);
            expiresAt = _accessExpiry[key];
        } else {
            _accessExpiry[key] = expiresAt;
        }

        _accessRecords[tokenId].push(AccessRecord({
            tokenId: tokenId,
            buyer: msg.sender,
            expiresAt: expiresAt,
            amountPaid: msg.value,
            isRental: true
        }));

        emit AccessGranted(tokenId, msg.sender, true, expiresAt);
    }

    function buyAgent(uint256 tokenId) external payable {
        PricingInfo memory pricing = _pricing[tokenId];
        require(pricing.configured, "PRICING_NOT_SET");
        require(pricing.buyPrice > 0, "NOT_FOR_SALE");
        require(msg.value >= pricing.buyPrice, "INSUFFICIENT_PAYMENT");

        bytes32 key = _accessKey(tokenId, msg.sender);
        require(!_activeAccess[key], "ALREADY_PURCHASED");

        _activeAccess[key] = true;

        _accessRecords[tokenId].push(AccessRecord({
            tokenId: tokenId,
            buyer: msg.sender,
            expiresAt: 0,
            amountPaid: msg.value,
            isRental: false
        }));

        emit AccessGranted(tokenId, msg.sender, false, 0);
    }

    function hasAccess(uint256 tokenId, address user) external view returns (bool) {
        bytes32 key = _accessKey(tokenId, user);

        if (_activeAccess[key]) return true;
        if (_accessExpiry[key] > block.timestamp) return true;

        return false;
    }

    function getPricing(uint256 tokenId) external view returns (PricingInfo memory) {
        return _pricing[tokenId];
    }

    function getAccessCount(uint256 tokenId) external view returns (uint256) {
        return _accessRecords[tokenId].length;
    }

    function _accessKey(uint256 tokenId, address user) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenId, user));
    }
}
