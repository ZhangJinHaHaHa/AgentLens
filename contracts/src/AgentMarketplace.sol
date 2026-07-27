// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AgentMarketplace {
    struct PricingInfo {
        uint256 pricePerDay;   // rent cost per day in wei
        bool configured;
    }

    struct AccessRecord {
        uint256 tokenId;
        address buyer;
        uint64 expiresAt;
        uint256 amountPaid;
        uint32 durationDays;
    }

    address public owner;
    address public operator;

    mapping(uint256 => PricingInfo) private _pricing;
    mapping(uint256 => AccessRecord[]) private _accessRecords;
    mapping(bytes32 => uint64) private _accessExpiry; // keccak256(tokenId, user) => expiresAt for rental

    event PriceSet(uint256 indexed tokenId, uint256 pricePerDay);
    event RentalGranted(
        uint256 indexed tokenId,
        address indexed renter,
        uint32 durationDays,
        uint64 expiresAt,
        uint256 amountPaid
    );
    event PaymentsWithdrawn(address indexed to, uint256 amount);

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
        uint256 pricePerDay
    ) external onlyOperator {
        require(pricePerDay > 0, "INVALID_PRICE");
        _pricing[tokenId] = PricingInfo({
            pricePerDay: pricePerDay,
            configured: true
        });
        emit PriceSet(tokenId, pricePerDay);
    }

    function rentAgent(uint256 tokenId, uint256 durationDays) external payable {
        PricingInfo memory pricing = _pricing[tokenId];
        require(pricing.configured, "PRICING_NOT_SET");
        require(durationDays > 0, "INVALID_DURATION");
        require(durationDays <= type(uint32).max, "DURATION_TOO_LARGE");

        uint256 totalCost = pricing.pricePerDay * durationDays;
        require(msg.value == totalCost, "INVALID_PAYMENT");

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
            amountPaid: totalCost,
            durationDays: uint32(durationDays)
        }));

        emit RentalGranted(tokenId, msg.sender, uint32(durationDays), expiresAt, totalCost);
    }

    function withdrawPayments(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "INVALID_RECIPIENT");
        require(amount <= address(this).balance, "INSUFFICIENT_BALANCE");

        (bool ok, ) = to.call{value: amount}("");
        require(ok, "TRANSFER_FAILED");

        emit PaymentsWithdrawn(to, amount);
    }

    function hasAccess(uint256 tokenId, address user) external view returns (bool) {
        bytes32 key = _accessKey(tokenId, user);

        if (_accessExpiry[key] > block.timestamp) return true;

        return false;
    }

    function getPricing(uint256 tokenId) external view returns (PricingInfo memory) {
        return _pricing[tokenId];
    }

    function getAccessCount(uint256 tokenId) external view returns (uint256) {
        return _accessRecords[tokenId].length;
    }

    function getAccessRecord(uint256 tokenId, uint256 index) external view returns (AccessRecord memory) {
        require(index < _accessRecords[tokenId].length, "INDEX_OUT_OF_BOUNDS");
        return _accessRecords[tokenId][index];
    }

    function _accessKey(uint256 tokenId, address user) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenId, user));
    }
}
