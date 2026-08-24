// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title 带六维评分、申诉记录和声誉增量的 Agent 审计登记表（V2）
/// @notice 在 V1 的身份、质押和审计流水上新增维度分、申诉生命周期以及成功/失败申诉计数，所有状态均保存在这一独立部署实例中。
/// @dev V1 `recordAuditResult` 入口仍可调用并把六维分写为全零；V2 入口接收六个 `uint16` 原值。合约不强制 0–10000 范围，也不从报告重新计算得分。
/// @dev owner 负责资金与操作员治理，operator/owner 独占审计、罚没和申诉写入；证据哈希、CID、评分与 outcome 都是该受信角色的链上声明，而非合约验证结论。
/// @dev token/audit/appeal ID 均按数组长度从 1 连续生成，审计只结算最新 Pending 项，申诉只能从 Pending 解析一次；读取函数依赖 ID 与 `index + 1` 的对应关系。
/// @dev 通过申诉只把 Slashed 审计标为 Compensated，不恢复 `totalBond`；显式 `compensateBond` 才增加账面保证金且同样不会向合约注资，释放时仍可能受实际余额限制。
/// @dev `getAverageScores` 排除六维全零记录后做整数向下取平均；历史 V1 写入因此不进入分母，这是前端和索引器必须保持的版本兼容语义。
/// @dev 本合约不是 V1 的代理实现或存储升级，旧事件签名虽保留但地址和状态不继承；转账、外部接收方回退或任一 require 失败会使整笔交易回滚。
contract AgentAuditRegistryV2 {
    string public constant name = "Agent Audit Identity V2";
    string public constant symbol = "AAI2";

    enum AuditStatus {
        Pending,
        Passed,
        Failed,
        Slashed,
        Compensated
    }

    enum AppealOutcome {
        Pending,
        Approved,
        Rejected
    }

    struct DimensionalScores {
        uint16 security;       // 0-10000 basis points
        uint16 taskExecution;
        uint16 cognitive;
        uint16 environment;
        uint16 engineering;
        uint16 compliance;
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
        DimensionalScores dimensionalScores;
    }

    struct AppealRecord {
        uint64 appealId;
        uint64 auditId;
        uint64 filedAt;
        uint64 resolvedAt;
        AppealOutcome outcome;
        bytes32 evidenceHash;
        string appealCID;
    }

    struct ReputationRecord {
        uint32 successfulAppeals;
        uint32 failedAppeals;
        int32 reputationDelta;
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
    mapping(uint256 => AppealRecord[]) private _appealRecords;
    mapping(uint256 => ReputationRecord) private _reputations;

    // Events — V1 compatible
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

    // New V2 events
    event AppealFiled(uint256 indexed tokenId, uint64 indexed auditId, uint64 appealId);
    event AppealResolved(uint256 indexed tokenId, uint64 indexed appealId, AppealOutcome outcome);
    event ReputationUpdated(uint256 indexed tokenId, int32 newDelta);

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
                appealApproved: false,
                dimensionalScores: DimensionalScores(0, 0, 0, 0, 0, 0)
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

    // V1-compatible audit result recording (no dimensional scores)
    /// @notice 使用 V1 参数形状结算审计，供尚未发送六维评分的调用方继续工作。
    /// @dev 兼容调用会明确落入六维全零哨兵；消费者应通过入口版本或全零约定区分“未提供”与真实零分。
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
        _recordAuditResultInternal(
            tokenId, auditScore, memoryPeakMb, cpuAvgMilli, requestIpCount,
            status, manifestHash, reportHash, evidenceRoot, attestationHash,
            evidenceCID, reportCID, manifestUrl,
            DimensionalScores(0, 0, 0, 0, 0, 0)
        );
    }

    // V2: audit result with dimensional scores
    /// @notice 结算审计并保存调用方给出的六维评分。
    /// @dev 这里只校验 token 存在、目标是最新 Pending 项且 status 非 Pending；分值尺度、报告一致性和哈希来源均由操作员信任域保证。
    function recordAuditResultV2(
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
        string calldata manifestUrl,
        DimensionalScores calldata scores
    ) external onlyOperator {
        _recordAuditResultInternal(
            tokenId, auditScore, memoryPeakMb, cpuAvgMilli, requestIpCount,
            status, manifestHash, reportHash, evidenceRoot, attestationHash,
            evidenceCID, reportCID, manifestUrl,
            scores
        );
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

    // ── Appeal management (V2) ────────────────────────────────────

    /// @notice 为既有审计追加一条待处理申诉并锚定证据摘要与 CID。
    /// @dev 同一 audit 可被多次立案，本函数不检查审计状态或去重；`appealId` 仅在该 token 的申诉数组内从 1 编号。
    function fileAppeal(
        uint256 tokenId,
        uint64 auditId,
        bytes32 evidenceHash,
        string calldata appealCID
    ) external onlyOperator {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");

        AuditRecord storage record = _getAuditRecord(tokenId, auditId);
        record.appealRequested = true;

        uint64 appealId = uint64(_appealRecords[tokenId].length + 1);
        _appealRecords[tokenId].push(
            AppealRecord({
                appealId: appealId,
                auditId: auditId,
                filedAt: uint64(block.timestamp),
                resolvedAt: 0,
                outcome: AppealOutcome.Pending,
                evidenceHash: evidenceHash,
                appealCID: appealCID
            })
        );

        emit AppealFiled(tokenId, auditId, appealId);
    }

    /// @notice 一次性解析 Pending 申诉，并更新成功/失败计数和有符号声誉增量。
    /// @dev Approved 只在原审计仍为 Slashed 时修改其状态/标志，不返还资金账面；Rejected 仅递减 reputationDelta，结果为链上操作员裁决。
    function resolveAppeal(
        uint256 tokenId,
        uint64 appealId,
        AppealOutcome outcome
    ) external onlyOperator {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");
        require(outcome != AppealOutcome.Pending, "INVALID_OUTCOME");

        AppealRecord storage appeal = _getAppealRecord(tokenId, appealId);
        require(appeal.outcome == AppealOutcome.Pending, "APPEAL_ALREADY_RESOLVED");

        appeal.outcome = outcome;
        appeal.resolvedAt = uint64(block.timestamp);

        ReputationRecord storage rep = _reputations[tokenId];

        if (outcome == AppealOutcome.Approved) {
            rep.successfulAppeals += 1;
            rep.reputationDelta += 1;

            // Auto-compensate: mark audit record as compensated
            AuditRecord storage auditRec = _getAuditRecord(tokenId, appeal.auditId);
            if (auditRec.status == AuditStatus.Slashed) {
                auditRec.status = AuditStatus.Compensated;
                auditRec.appealApproved = true;
            }
        } else {
            rep.failedAppeals += 1;
            rep.reputationDelta -= 1;
        }

        emit AppealResolved(tokenId, appealId, outcome);
        emit ReputationUpdated(tokenId, rep.reputationDelta);
    }

    // ── View functions ────────────────────────────────────────────

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

    function getDimensionalScores(
        uint256 tokenId,
        uint256 auditIndex
    ) external view returns (DimensionalScores memory) {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");
        require(auditIndex < _auditRecords[tokenId].length, "INDEX_OUT_OF_BOUNDS");
        return _auditRecords[tokenId][auditIndex].dimensionalScores;
    }

    function getAverageScores(uint256 tokenId) external view returns (DimensionalScores memory) {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");
        uint256 count = _auditRecords[tokenId].length;
        require(count > 0, "NO_AUDIT_RECORD");

        uint256 sumSec;
        uint256 sumTask;
        uint256 sumCog;
        uint256 sumEnv;
        uint256 sumEng;
        uint256 sumComp;
        uint256 scored;

        for (uint256 i = 0; i < count; i++) {
            DimensionalScores memory s = _auditRecords[tokenId][i].dimensionalScores;
            // Only count records that have dimensional scores set
            if (s.security > 0 || s.taskExecution > 0 || s.cognitive > 0 ||
                s.environment > 0 || s.engineering > 0 || s.compliance > 0) {
                sumSec += s.security;
                sumTask += s.taskExecution;
                sumCog += s.cognitive;
                sumEnv += s.environment;
                sumEng += s.engineering;
                sumComp += s.compliance;
                scored++;
            }
        }

        if (scored == 0) {
            return DimensionalScores(0, 0, 0, 0, 0, 0);
        }

        return DimensionalScores(
            uint16(sumSec / scored),
            uint16(sumTask / scored),
            uint16(sumCog / scored),
            uint16(sumEnv / scored),
            uint16(sumEng / scored),
            uint16(sumComp / scored)
        );
    }

    function getAppealRecord(
        uint256 tokenId,
        uint64 appealId
    ) external view returns (AppealRecord memory) {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");
        return _getAppealRecord(tokenId, appealId);
    }

    function getAppealCount(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");
        return _appealRecords[tokenId].length;
    }

    function getReputation(uint256 tokenId) external view returns (ReputationRecord memory) {
        require(_exists(tokenId), "TOKEN_NOT_FOUND");
        return _reputations[tokenId];
    }

    // ── Internal helpers ──────────────────────────────────────────

    function _recordAuditResultInternal(
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
        string calldata manifestUrl,
        DimensionalScores memory scores
    ) internal {
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
        record.dimensionalScores = scores;

        AgentProfile storage profile = _profiles[tokenId];
        profile.lastAuditAt = uint64(block.timestamp);
        profile.auditCount += 1;

        emit AuditRecorded(tokenId, record.auditId, status, auditScore, reportHash, reportCID);
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

    function _getAppealRecord(
        uint256 tokenId,
        uint64 appealId
    ) internal view returns (AppealRecord storage record) {
        require(appealId > 0, "INVALID_APPEAL_ID");
        uint256 index = uint256(appealId - 1);
        require(index < _appealRecords[tokenId].length, "APPEAL_NOT_FOUND");
        record = _appealRecords[tokenId][index];
    }

    function _sendValue(address payable to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "TRANSFER_FAILED");
    }
}
