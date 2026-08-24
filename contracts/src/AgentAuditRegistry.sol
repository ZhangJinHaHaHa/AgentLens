// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Agent 审计身份与保证金登记表（V1）
/// @notice 接收开发者的服务费和保证金，为“开发者地址 + Agent 名称”铸造不可转移的身份编号，并保存操作员提交的链下审计摘要。
/// @dev `stake` 的输入是名称、manifest URL 与原生币；输出是稳定 tokenId、新增 Pending 审计及事件。查询接口返回档案或按 1 起始编号关联的审计记录。
/// @dev owner 控制定价、操作员与服务费提取，operator/owner 被信任为链下审计、申诉、罚没和释放保证金的权威写入方；合约不抓取 URL/CID，也不验证哈希对应的原文或证明。
/// @dev 身份键在同一开发者下按名称字节精确区分；审计数组只追加，结果只能写入最新 Pending 项，`auditId == index + 1` 是所有索引读取的核心不变量。
/// @dev `totalBond` 是逐档案账面值：罚没只减少账面但不转出资金，补偿只增加账面且不注入资金；后续释放仍受合约实际余额和外部转账成功约束。
/// @dev 所有 require 或 ETH call 失败都会回滚本次状态；转账前先扣账，但接收方仍属于外部调用边界。链下编排不应把交易发送失败与可安全重试等同起来。
/// @dev `Transfer`/`ownerOf`/`balanceOf` 仅提供身份型子集，没有 approve、transfer、ERC165 或 tokenURI，集成方不得把它当成完整 ERC-721 实现。
contract AgentAuditRegistry {
    string public constant name = "Agent Audit Identity";
    string public constant symbol = "AAI";

    enum AuditStatus {
        Pending,
        Passed,
        Failed,
        Slashed,
        Compensated
    }

    struct AgentProfile {
        address developer;
        string agentName;
        uint256 tokenId;
        uint256 totalBond;
        bool blacklisted;
        uint64 createdAt;
        uint64 lastAuditAt;
        uint32 auditCount;
    }

    struct AuditRecord {
        uint64 auditId;
        uint64 timestamp;
        uint32 auditScore;
        uint32 memoryPeakMb;
        uint32 cpuAvgMilli;
        uint32 requestIpCount;
        AuditStatus status;
        bytes32 manifestHash;
        bytes32 reportHash;
        bytes32 evidenceRoot;
        bytes32 attestationHash;
        string evidenceCID;
        string reportCID;
        string manifestUrl;
        bool appealRequested;
        bool appealApproved;
    }

    address public owner;
    address public operator;
    uint256 public serviceFee;
    uint256 public minimumBond;
    uint256 public accruedServiceFees;

    uint256 private _nextTokenId = 1;

    mapping(uint256 => AgentProfile) private _profiles;
    mapping(uint256 => AuditRecord[]) private _auditRecords;
    mapping(bytes32 => uint256) private _tokenIdsByIdentity;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event AgentRegistered(uint256 indexed tokenId, address indexed developer, string agentName);
    event AuditRequested(
        uint256 indexed tokenId,
        address indexed developer,
        string agentName,
        string manifestUrl,
        uint256 bondAmount,
        uint64 timestamp
    );
    event AuditRecorded(
        uint256 indexed tokenId,
        uint64 indexed auditId,
        AuditStatus status,
        uint32 auditScore,
        bytes32 reportHash,
        string reportCID
    );
    event BondSlashed(
        uint256 indexed tokenId,
        uint64 indexed auditId,
        uint256 amount,
        bytes32 reasonCode
    );
    event AppealRequested(uint256 indexed tokenId, uint64 indexed auditId);
    event BondCompensated(
        uint256 indexed tokenId,
        uint64 indexed auditId,
        uint256 amount,
        bytes32 reasonCode
    );
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event PricingUpdated(uint256 serviceFee, uint256 minimumBond);
    event ServiceFeesWithdrawn(address indexed to, uint256 amount);
    event BondReleased(uint256 indexed tokenId, address indexed developer, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner, "ONLY_OPERATOR");
        _;
    }

    constructor(uint256 initialServiceFee, uint256 initialMinimumBond, address initialOperator) {
        owner = msg.sender;
        operator = initialOperator == address(0) ? msg.sender : initialOperator;
        serviceFee = initialServiceFee;
        minimumBond = initialMinimumBond;
    }

    function setOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "INVALID_OPERATOR");
        address previousOperator = operator;
        operator = newOperator;
        emit OperatorUpdated(previousOperator, newOperator);
    }

    function setPricing(uint256 newServiceFee, uint256 newMinimumBond) external onlyOwner {
        serviceFee = newServiceFee;
        minimumBond = newMinimumBond;
        emit PricingUpdated(newServiceFee, newMinimumBond);
    }

    function withdrawServiceFees(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "INVALID_RECIPIENT");
        require(amount <= accruedServiceFees, "INSUFFICIENT_FEES");

        accruedServiceFees -= amount;
        _sendValue(to, amount);

        emit ServiceFeesWithdrawn(to, amount);
    }

    function releaseBond(uint256 tokenId, uint256 amount) external onlyOperator {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");

        AgentProfile storage profile = _profiles[tokenId];
        require(amount <= profile.totalBond, "INSUFFICIENT_BOND");

        profile.totalBond -= amount;
        _sendValue(payable(profile.developer), amount);

        emit BondReleased(tokenId, profile.developer, amount);
    }

    function balanceOf(address account) external view returns (uint256) {
        require(account != address(0), "ZERO_ADDRESS");
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "TOKEN_NOT_FOUND");
        return tokenOwner;
    }

    /// @notice 为调用者的 Agent 增加保证金并创建一次待审计请求，首次出现的名称同时生成身份 tokenId。
    /// @param agentName 参与身份键计算的原始名称；大小写、空格和编码差异都会形成不同身份。
    /// @param manifestUrl 链下 manifest 定位符；这里只检查非空并原样记录，不保证可访问性或内容真实性。
    /// @return tokenId 新建或复用的身份编号。
    /// @dev `msg.value - serviceFee` 全部计入该档案保证金；同一身份可并存多条历史记录，但一次只能结算最新 Pending 记录。
    function stake(
        string calldata agentName,
        string calldata manifestUrl
    ) external payable returns (uint256 tokenId) {
        require(bytes(agentName).length > 0, "EMPTY_AGENT_NAME");
        require(bytes(manifestUrl).length > 0, "EMPTY_MANIFEST_URL");
        require(msg.value >= serviceFee + minimumBond, "INSUFFICIENT_VALUE");

        uint256 bondAmount = msg.value - serviceFee;
        accruedServiceFees += serviceFee;

        bytes32 identityKey = _identityKey(msg.sender, agentName);
        tokenId = _tokenIdsByIdentity[identityKey];

        if (tokenId == 0) {
            tokenId = _mintIdentity(msg.sender, agentName);
        }

        AgentProfile storage profile = _profiles[tokenId];
        profile.totalBond += bondAmount;

        uint64 auditId = uint64(_auditRecords[tokenId].length + 1);
        _auditRecords[tokenId].push(
            AuditRecord({
                auditId: auditId,
                timestamp: uint64(block.timestamp),
                auditScore: 0,
                memoryPeakMb: 0,
                cpuAvgMilli: 0,
                requestIpCount: 0,
                status: AuditStatus.Pending,
                manifestHash: bytes32(0),
                reportHash: bytes32(0),
                evidenceRoot: bytes32(0),
                attestationHash: bytes32(0),
                evidenceCID: "",
                reportCID: "",
                manifestUrl: manifestUrl,
                appealRequested: false,
                appealApproved: false
            })
        );

        emit AuditRequested(
            tokenId,
            msg.sender,
            agentName,
            manifestUrl,
            bondAmount,
            uint64(block.timestamp)
        );
    }

    /// @notice 由受信操作员把最新待审计项结算为非 Pending 状态，并锚定指标、哈希与链下内容地址。
    /// @dev 参数值没有链上范围、签名或内容校验；事件与存储仅证明授权账户提交了这些声明，不能替代对报告、证据或 attestation 的独立验证。
    function recordAuditResult(
        uint256 tokenId,
        uint32 auditScore,
        uint32 memoryPeakMb,
        uint32 cpuAvgMilli,
        uint32 requestIpCount,
        AuditStatus status,
        bytes32 manifestHash,
        bytes32 reportHash,
        bytes32 evidenceRoot,
        bytes32 attestationHash,
        string calldata evidenceCID,
        string calldata reportCID,
        string calldata manifestUrl
    ) external onlyOperator {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");
        require(status != AuditStatus.Pending, "INVALID_STATUS");

        AuditRecord storage record = _latestPendingRecord(tokenId);
        record.timestamp = uint64(block.timestamp);
        record.auditScore = auditScore;
        record.memoryPeakMb = memoryPeakMb;
        record.cpuAvgMilli = cpuAvgMilli;
        record.requestIpCount = requestIpCount;
        record.status = status;
        record.manifestHash = manifestHash;
        record.reportHash = reportHash;
        record.evidenceRoot = evidenceRoot;
        record.attestationHash = attestationHash;
        record.evidenceCID = evidenceCID;
        record.reportCID = reportCID;
        record.manifestUrl = manifestUrl;

        AgentProfile storage profile = _profiles[tokenId];
        profile.lastAuditAt = uint64(block.timestamp);
        profile.auditCount += 1;

        emit AuditRecorded(tokenId, record.auditId, status, auditScore, reportHash, reportCID);
    }

    /// @notice 从档案账面保证金中罚没指定金额并把关联审计标为 Slashed。
    /// @dev 本操作同时永久设置 `blacklisted = true`，但不会把罚没金额发送给 owner/operator 或转入 `accruedServiceFees`。
    function slashBond(
        uint256 tokenId,
        uint64 auditId,
        uint256 amount,
        bytes32 reasonCode
    ) external onlyOperator {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");

        AgentProfile storage profile = _profiles[tokenId];
        require(amount <= profile.totalBond, "INSUFFICIENT_BOND");

        AuditRecord storage record = _getAuditRecord(tokenId, auditId);
        profile.totalBond -= amount;
        profile.blacklisted = true;
        record.status = AuditStatus.Slashed;

        emit BondSlashed(tokenId, auditId, amount, reasonCode);
    }

    function markAppealRequested(uint256 tokenId, uint64 auditId) external onlyOperator {
        AuditRecord storage record = _getAuditRecord(tokenId, auditId);
        record.appealRequested = true;
        emit AppealRequested(tokenId, auditId);
    }

    /// @notice 将 Slashed 审计改为 Compensated，并把金额加回档案账面保证金。
    /// @dev 该函数不接收 ETH；操作员必须保证补偿后的账面总额有实际合约余额支撑，否则未来 `releaseBond` 可能因转账失败整体回滚。
    function compensateBond(
        uint256 tokenId,
        uint64 auditId,
        uint256 amount,
        bytes32 reasonCode
    ) external onlyOperator {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");

        AuditRecord storage record = _getAuditRecord(tokenId, auditId);
        require(record.status == AuditStatus.Slashed, "AUDIT_NOT_SLASHED");

        AgentProfile storage profile = _profiles[tokenId];
        profile.totalBond += amount;
        record.status = AuditStatus.Compensated;
        record.appealApproved = true;

        emit BondCompensated(tokenId, auditId, amount, reasonCode);
    }

    function getTokenId(address developer, string calldata agentName) external view returns (uint256) {
        return _tokenIdsByIdentity[_identityKey(developer, agentName)];
    }

    function getAgentProfile(uint256 tokenId) external view returns (AgentProfile memory) {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");
        return _profiles[tokenId];
    }

    function getLatestAuditReport(uint256 tokenId) external view returns (AuditRecord memory) {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");
        uint256 count = _auditRecords[tokenId].length;
        require(count > 0, "NO_AUDIT_RECORD");
        return _auditRecords[tokenId][count - 1];
    }

    function getAuditReportByIndex(
        uint256 tokenId,
        uint256 index
    ) external view returns (AuditRecord memory) {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");
        require(index < _auditRecords[tokenId].length, "INDEX_OUT_OF_BOUNDS");
        return _auditRecords[tokenId][index];
    }

    function getAuditCount(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");
        return _auditRecords[tokenId].length;
    }

    function _mintIdentity(address developer, string calldata agentName) internal returns (uint256 tokenId) {
        tokenId = _nextTokenId;
        _nextTokenId += 1;

        _owners[tokenId] = developer;
        _balances[developer] += 1;
        _tokenIdsByIdentity[_identityKey(developer, agentName)] = tokenId;
        _profiles[tokenId] = AgentProfile({
            developer: developer,
            agentName: agentName,
            tokenId: tokenId,
            totalBond: 0,
            blacklisted: false,
            createdAt: uint64(block.timestamp),
            lastAuditAt: 0,
            auditCount: 0
        });

        emit Transfer(address(0), developer, tokenId);
        emit AgentRegistered(tokenId, developer, agentName);
    }

    function _identityKey(address developer, string memory agentName) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(developer, ":", agentName));
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _owners[tokenId] != address(0);
    }

    function _latestPendingRecord(uint256 tokenId) internal view returns (AuditRecord storage record) {
        uint256 count = _auditRecords[tokenId].length;
        require(count > 0, "NO_AUDIT_RECORD");

        record = _auditRecords[tokenId][count - 1];
        require(record.status == AuditStatus.Pending, "NO_PENDING_AUDIT");
    }

    function _getAuditRecord(
        uint256 tokenId,
        uint64 auditId
    ) internal view returns (AuditRecord storage record) {
        require(auditId > 0, "INVALID_AUDIT_ID");
        uint256 index = uint256(auditId - 1);
        require(index < _auditRecords[tokenId].length, "AUDIT_NOT_FOUND");
        record = _auditRecords[tokenId][index];
    }

    function _sendValue(address payable to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "TRANSFER_FAILED");
    }
}
