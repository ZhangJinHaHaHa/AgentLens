// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Agent 按日租赁与访问期限登记市场
/// @notice 操作员为任意 tokenId 设置日价，租户精确支付原生币后获得按区块时间计算的访问期限，并保留每次购买的追加式历史记录。
/// @dev 本合约不查询 AgentAuditRegistry，也不验证 tokenId 存在、所有权或黑名单；tokenId 的业务真实性由设置价格的 owner/operator 和链下集成共同保证。
/// @dev 活跃租赁从原 expiresAt 继续延长，过期租赁从当前 block.timestamp 重新起算；`_accessExpiry` 是实时授权真值，`AccessRecord` 数组只用于不可变历史查询。
/// @dev 租金必须等于 `pricePerDay * durationDays`，无找零、退款或卖方分账；全部余额由 owner 可提取，operator 地址在构造后没有更新入口。
/// @dev 时间以链上时间戳和整日秒数表示，duration 必须在 1..uint32.max；价格未配置、付款不精确、索引越界或接收方 ETH call 失败均回滚。
/// @dev `hasAccess` 是评价合约依赖的同步信任边界；重新部署市场或更换其地址不会自动迁移价格、租赁历史和访问期限。
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

    /// @notice 为调用者购买或延长指定 tokenId 的访问期。
    /// @dev 成功后资金留在本合约、授权截止时间和购买记录同时更新；交易重放会再次收费并再次延长，不具备业务幂等性。
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

    /// @notice owner 从合约总余额提取指定金额。
    /// @dev 本合约不按 token、出租方或订单隔离资金；外部 call 失败时交易回滚，成功后余额变化由 EVM 转账结果体现。
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
