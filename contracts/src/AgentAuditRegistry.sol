// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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

    function balanceOf(address account) external view returns (uint256) {
        require(account != address(0), "ZERO_ADDRESS");
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "TOKEN_NOT_FOUND");
        return tokenOwner;
    }

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
}
