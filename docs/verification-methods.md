# Agent Shenji — 已实现的验证方法

本文档描述项目中已实现的三层验证体系：**TEE 证明验证**、**存证链验证**、**报告完整性验证**，以及它们之间的跨层绑定关系。

> **ZK 状态**：项目当前 **没有** 任何零知识证明 (ZK) 相关代码。

---

## 目录

1. [报告完整性验证 (Report Verification)](#1-报告完整性验证)
2. [存证链验证 (Evidence Chain Verification)](#2-存证链验证)
3. [TEE 证明验证 (Attestation Verification)](#3-tee-证明验证)
4. [跨层绑定 (Cross-Layer Binding)](#4-跨层绑定)
5. [CLI 使用方式](#5-cli-使用方式)
6. [文件命名约定](#6-文件命名约定)

---

## 1. 报告完整性验证

### 核心文件

| 文件 | 职责 |
|------|------|
| `sandbox/src/report/buildAuditReport.ts` | 构建报告 + 计算哈希 |
| `sandbox/src/report/persistAuditReport.ts` | 原子落盘 (link-based) |
| `sandbox/src/report/readPersistedAuditReport.ts` | 读取 + 验证 |
| `sandbox/src/cli/reportVerify.ts` | CLI 入口 |

### 验证算法

```
1. 校验 eventKey 格式：必须匹配 ^0x[0-9a-fA-F]+:\d+$
2. 扫描 reports/ 目录，匹配文件名模式 <tokenId>-<txHash>-<logIndex>-<reportHash>.json
   - 0 个匹配 → not_found
   - 2+ 个匹配 → conflict
3. 读取文件原始字节
4. 重算 SHA-256(fileContents)
5. 与文件名中嵌入的 64 位 hex hash 比对（大小写不敏感）
   - 一致 → verified
   - 不一致 → hash_mismatch（返回 expected + actual）
```

### 哈希计算

```typescript
reportHash = sha256(JSON.stringify(report, null, 2))
```

报告内容包含：审计决策、资源指标、网络活动、healthcheck 结果、response trace、以及嵌入的 `evidenceRoot` 和 `attestationHash` 引用。

---

## 2. 存证链验证

### 核心文件

| 文件 | 职责 |
|------|------|
| `sandbox/src/evidence/buildAuditEvidenceEvent.ts` | 构建单个存证事件 + 哈希 |
| `sandbox/src/evidence/evidenceChain.ts` | 维护哈希链上下文 |
| `sandbox/src/evidence/persistAuditEvidence.ts` | 原子落盘 |
| `sandbox/src/evidence/readPersistedAuditEvidence.ts` | 读取 + 验证 |
| `sandbox/src/cli/evidenceVerify.ts` | CLI 入口 |

### 哈希链结构

每个存证事件包含 7 个字段：

```typescript
{
  schemaVersion: "audit-evidence-event.v1",
  eventKey,      // "0x<txHash>:<logIndex>"
  tokenId,
  sequence,      // 从 0 开始递增
  stage,         // 10 个有序阶段之一
  timestamp,
  prevHash,      // 前一个事件的 eventHash（第一个事件为 ZERO_EVIDENCE_HASH）
  payloadHash    // sha256(JSON.stringify(canonicalize(payload)))
}
```

其中 `canonicalize` 递归地按字典序排列对象 key，确保相同内容的 JSON 产生相同哈希。

```
eventHash = sha256(canonicalize({ schemaVersion, eventKey, tokenId, sequence, stage, timestamp, prevHash, payloadHash }))
```

**evidenceRoot** = 最后一个事件的 `eventHash`。任何历史事件的篡改都会导致后续所有哈希失效，最终改变 evidenceRoot。

### 10 个有序阶段

```
audit_requested_observed → manifest_fetched → manifest_validated →
container_started → healthcheck_passed → audit_request_sent →
audit_response_received → resource_usage_collected →
network_activity_collected → report_built
```

### 验证算法

```
1. 校验 eventKey 格式
2. 扫描 evidence/ 目录，匹配文件名提取嵌入的 evidenceRoot
   - 0 匹配 → not_found / 2+ → conflict
3. 解析 JSON，遍历 events 数组
4. 从头重算每个事件的 eventHash（使用其 prevHash + 自身字段）
5. 最后一个 eventHash 即为重算的 evidenceRoot
6. 三重一致性校验：
   - 重算的 root == 文件名嵌入的 hash
   - payload.evidenceRoot == 文件名嵌入的 hash
   - payload.eventCount == payload.events.length
7. 全部一致 → verified，任一不匹配 → hash_mismatch
```

---

## 3. TEE 证明验证

### 核心文件

| 文件 | 职责 |
|------|------|
| `sandbox/src/attestation/buildAuditAttestation.ts` | 构建 attestation bundle |
| `sandbox/src/attestation/persistAuditAttestation.ts` | 原子落盘 |
| `sandbox/src/attestation/readPersistedAuditAttestation.ts` | 读取 + 多层验证 |
| `sandbox/src/attestation/attestationQuoteValidator.ts` | Quote 字段校验器 |
| `sandbox/src/attestation/sgxDcapQuoteValidator.ts` | SGX DCAP v3 二进制解析 |
| `sandbox/src/attestation/readAttestationVerifyConfig.ts` | 环境变量配置 |
| `sandbox/src/attestation/createTeeProvider.ts` | Provider 工厂 |
| `sandbox/src/cli/attestationVerify.ts` | CLI 入口 |

### Attestation Bundle 结构

```typescript
{
  schemaVersion: "audit-attestation.v1",
  eventKey: "0x<txHash>:<logIndex>",
  tokenId: "1",
  manifestHash: "<64 hex>",
  evidenceRoot: "<64 hex>",
  verifier: {
    type: "sgx-dcap" | "mock-tee",
    measurement: "<MRENCLAVE, 64 hex>",
    quoteFormat: "sgx-dcap-v3" | "mock-quote",
    sessionPublicKey: "<hex>",
    quote: "<hex-encoded binary quote>"
  }
}
```

### 验证算法（完整 7 步）

```
1. 校验 eventKey 格式
2. 扫描 attestations/ 目录，匹配文件名提取嵌入的 attestationHash
   - 0 匹配 → not_found / 2+ → conflict
3. 读取文件，重算 sha256(fileContents)，与文件名 hash 比对
   - 不一致 → hash_mismatch
4. 解析 JSON，校验 schema 结构：
   - schemaVersion === "audit-attestation.v1"
   - 所有字段非空字符串
5. 如果提供了 expectedVerifier，逐字段比对：
   - verifier.type vs expectedVerifier.providerType
   - verifier.measurement vs expectedVerifier.measurement
   - verifier.quoteFormat vs expectedVerifier.quoteFormat
   - 不一致 → verifier_mismatch（返回 field/expected/actual）
6. 如果 verifyReportDataBinding === true 且 quoteFormat === "sgx-dcap-v3"：
   a. 解析 SGX DCAP v3 二进制 quote（见下方）
   b. 计算期望的 report_data = sha256(eventKey + manifestHash + evidenceRoot)
   c. 与 quote 中的 report_data 字段逐字节比对
   - 解析失败 → sgx_quote_invalid
   - 不一致 → report_data_mismatch
7. 全部通过 → verified
```

### SGX DCAP v3 Quote 二进制结构

```
偏移量      字段                   大小
───────────────────────────────────────
0-1        version (必须 = 3)      2 bytes
2-3        att_key_type             2 bytes
4-7        tee_type (必须 = 0)     4 bytes (0 = SGX)
8-9        qe_svn                   2 bytes
10-11      pce_svn                  2 bytes
12-27      qe_vendor_id            16 bytes
28-47      user_data               20 bytes
───── Report Body (offset 48) ──────
48-63      cpu_svn                 16 bytes
64-79      misc_select              ...
...
112-143    MRENCLAVE               32 bytes ← enclave 度量值
...
176-207    MRSIGNER                32 bytes
...
368-431    report_data             64 bytes ← 绑定字段
───── Auth Data (offset 432+) ──────
432-435    auth_data_size           4 bytes
436+       ECDSA signature + cert chain
```

### report_data 绑定计算

```typescript
const digest = sha256(eventKey + manifestHash + evidenceRoot);  // 32 bytes
const reportData = Buffer.alloc(64);                            // 64 bytes
digest.copy(reportData, 0, 0, 32);                              // 前 32 字节是 digest，后 32 字节零填充
```

### Quote 验证器组合

当 `expectedQuoteFormat === "sgx-dcap-v3"` 时，系统自动组合两个验证器：

```
CompositeValidator = [
  ExpectedFieldValidator（检查 providerType / measurement / quoteFormat）,
  SgxDcapQuoteValidator（解析二进制、校验 version/teeType/mrEnclave/reportData）
]
```

顺序执行，任一失败即停止。

---

## 4. 跨层绑定

三层通过 SGX quote 的 `report_data` 字段绑定在一起：

```
report_data[0..31] = sha256(eventKey + manifestHash + evidenceRoot)
```

| 字段 | 含义 | 来源 |
|------|------|------|
| `eventKey` | 链上审计请求的唯一标识 | `<txHash>:<logIndex>` |
| `manifestHash` | Agent manifest 的 SHA-256 | 报告层 |
| `evidenceRoot` | 存证链最终哈希 | 存证层 |

**安全保证**：开启 `verifyReportDataBinding` 后，验证系统可以密码学证明：由 `MRENCLAVE` 标识的 SGX enclave 在特定链上 token（`eventKey`）的审计中，针对特定 manifest（`manifestHash`），产生了特定的存证链（`evidenceRoot`）——无法在不破解 SHA-256 的前提下伪造。

### 信任链

```
链上合约 (attestationHash)
    ↓ 哈希引用
Attestation Bundle (包含 SGX quote)
    ↓ report_data 绑定
    ├── eventKey → 链上 token
    ├── manifestHash → 被审计的 Agent 代码
    └── evidenceRoot → 存证链
                          ↓ 哈希链
                          各阶段存证事件（manifest获取、容器启动、审计执行…）
                              ↓ payloadHash
                              每个事件的详细数据
```

---

## 5. CLI 使用方式

### 报告验证

```bash
npm run run:report:verify -- --event-key 0x<txHash>:<logIndex> [--state-dir /path]
```

### 存证链验证

```bash
npm run run:evidence:verify -- --event-key 0x<txHash>:<logIndex> [--state-dir /path]
```

### TEE 证明验证

```bash
# 基础验证（哈希完整性）
npm run run:attestation:verify -- --event-key 0x<txHash>:<logIndex> [--state-dir /path]

# 带期望值的验证
AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE=sgx-dcap \
AUDIT_ATTESTATION_EXPECTED_MEASUREMENT=<MRENCLAVE> \
AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT=sgx-dcap-v3 \
AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING=true \
npm run run:attestation:verify -- --event-key 0x<txHash>:<logIndex>
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE` | 期望的 TEE 类型（如 `sgx-dcap`） |
| `AUDIT_ATTESTATION_EXPECTED_MEASUREMENT` | 期望的 MRENCLAVE（64 hex） |
| `AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT` | 期望的 quote 格式（如 `sgx-dcap-v3`） |
| `AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING` | 设为 `true` 启用 report_data 绑定验证 |

### 返回码

所有 CLI 工具：`0` = verified，`1` = 其他状态。

### 输出格式

JSON 到 stdout，示例：

```json
{
  "status": "verified",
  "eventKey": "0xabc:0",
  "attestationFilePath": "/path/to/attestations/1-0xabc-0-<hash>.json",
  "attestationHash": "<64 hex>"
}
```

---

## 6. 文件命名约定

三层验证共用相同的文件命名模式：

```
<tokenId>-<txHash>-<logIndex>-<contentHash>.json
```

| 层 | 目录 | contentHash 含义 |
|---|------|------------------|
| 报告 | `reports/` | `reportHash` = sha256(报告 JSON) |
| 存证 | `evidence/` | `evidenceRoot` = 最后一个 eventHash |
| 证明 | `attestations/` | `attestationHash` = sha256(bundle JSON) |

落盘使用 `link()` 原子写入：先写 UUID 临时文件，再 `link` 到目标路径，确保不会出现半写文件。如果目标已存在且内容不同，抛出 conflict 错误。

---

## 7. 生产部署状态 (2026-04-16)

### 运行中的 TEE 闭环

| 组件 | 部署位置 | 端口 |
|------|----------|------|
| Listener / Registry Writeback | `203.91.76.159` (Tencent Cloud) | docker-compose, 无外部端口 |
| Attestation API (Gramine SGX) | `43.134.90.165` (Tencent Cloud M6ce) | `3311` |
| AgentAuditRegistryV2 | Polygon Edge `chainId=302612` | `0x4A679253410272dd5232B3Ff7cF5dbB88f295319` |

### 当前生产的 enclave pin

| 项 | 值 |
|----|----|
| `AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE` | `sgx-dcap` |
| `AUDIT_ATTESTATION_EXPECTED_MEASUREMENT` (MRENCLAVE) | `1656d0e5f1dbac0e687662f79b8b5bf8629e40224567ecb823d1eb409f0b16b8` |
| `AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT` | `sgx-dcap-v3` |
| `AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING` | `true` |

上述值在 listener 的 `createHttpAttestationClient` 中强制执行 —— 任何返回
不同 MRENCLAVE / quoteFormat / providerType 或错误 `report_data` 的 quote 都会
导致 audit 被标记为失败，且 `record.attestationHash = bytes32(0)`。

### 自动化冒烟

`infra/production/scripts/run-tee-e2e.sh` 提供一键式端到端验证：

```bash
bash infra/production/scripts/run-tee-e2e.sh --env infra/production/.env.e2e
```

成功样例见 `infra/production/scripts/tee-e2e-summary.example.json`。

### 前端 UI

`AuditReportPage` 通过 `<AttestationVerificationCard />` 展示：

- `attestationHash`（非零 → 绿色 "SGX-DCAP verified" badge + 截短 hash）
- 生产部署所 pin 的 MRENCLAVE / provider / quote format / report_data binding 标志

对应组件：
- `frontend/src/components/AttestationBadge.tsx`
- `frontend/src/components/AttestationVerificationCard.tsx`

配置入口：`frontend/src/config/appConfig.ts`，通过
`VITE_AUDIT_ATTESTATION_EXPECTED_*` 注入。
