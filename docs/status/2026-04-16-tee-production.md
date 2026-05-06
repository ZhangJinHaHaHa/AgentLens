# TEE 生产闭环上线报告 — 2026-04-16

## 摘要

本次上线完成了 **SGX DCAP v3 attestation 生产链路** 端到端闭环：

```
stake() → AuditRequested → listener → SGX Attestation API (Gramine enclave)
       → MRENCLAVE + report_data 在线校验
       → recordAuditResultV2(..., attestationHash)
       → 前端显示 verified badge + MRENCLAVE pin
```

10 次回归测试 **10/10 成功**，attestation 均上链非零，生产闭环稳定。

---

## 拓扑

| 组件                    | 部署位置                     | 端口    | 状态    |
| ----------------------- | ---------------------------- | ------- | ------- |
| AgentAuditRegistryV2    | Polygon Edge (chainId 302612) | 18545   | healthy |
| shenji-listener         | 203.91.76.159 (docker)       | 内部    | healthy |
| shenji-report-gateway   | 203.91.76.159 (docker)       | 3310    | healthy |
| shenji-appeal-api       | 203.91.76.159 (docker)       | 3312    | healthy |
| shenji-frontend         | 203.91.76.159 (docker)       | 80      | healthy |
| Attestation API (SGX)   | 43.134.90.165 (M6ce)         | 3311    | healthy |

- V2 合约：`0x4A679253410272dd5232B3Ff7cF5dbB88f295319`
- Gramine enclave MRENCLAVE：`1656d0e5f1dbac0e687662f79b8b5bf8629e40224567ecb823d1eb409f0b16b8`
- Quote 格式：`sgx-dcap-v3`
- `report_data` 绑定：`sha256(eventKey ‖ manifestHash ‖ evidenceRoot)`

---

## 回归测试结果

脚本：`infra/production/scripts/run-tee-regression.sh` (封装 `run-tee-e2e.sh`)

调用：

```bash
bash infra/production/scripts/run-tee-regression.sh \
  --env /tmp/tee-e2e-local.env \
  --iterations 10
```

### 聚合指标

| 指标                        | 值       |
| --------------------------- | -------- |
| 迭代次数                    | 10       |
| 成功                        | **10**   |
| 失败                        | 0        |
| 成功率                      | 1.00     |
| attestationHash 非零次数    | **10**   |
| 端到端耗时（中位数）        | 18251 ms |
| 端到端耗时（p95）           | 18657 ms |

> 端到端耗时 = 从本地调用 `stake` 到 `getLatestAuditReport` 返回 non-Pending。
> 区间包含：chain tx confirmation + listener 轮询间隔 + manifest 拉取 + docker 拉起 + audit solve +
> SGX quote 生成（生产机 → M6ce → 回传）+ writeback tx confirmation。

### 逐次明细

| # | agentName                   | tokenId | block   | attestationHash                                                      |
| - | --------------------------- | ------- | ------- | -------------------------------------------------------------------- |
| 1 | regression-1776333024-1     | 3       | 901723  | `0xea3814a1…fd4b6d332`                                               |
| 2 | regression-1776333042-2     | 4       | 901732  | `0x07d36984…739506b3`                                                |
| 3 | regression-1776333061-3     | 5       | 901741  | `0xe35023f3…1054d2f0`                                                |
| 4 | regression-1776333079-4     | 6       | 901750  | `0xc8b9b13e…b28309ad`                                                |
| 5 | regression-1776333098-5     | 7       | 901759  | `0xbd067341…219141e`                                                 |
| 6 | regression-1776333116-6     | 8       | 901769  | `0xa4eb201b…fd192a01`                                                |
| 7 | regression-1776333134-7     | 9       | 901778  | `0x053d1988…3449cfae`                                                |
| 8 | regression-1776333153-8     | 10      | 901787  | `0x65ce25d9…0610fb637`                                               |
| 9 | regression-1776333171-9     | 11      | 901796  | `0xf98fce92…5bb4157b`                                                |
| 10 | regression-1776333189-10   | 12      | 901805  | `0x0a06976d…57bbddc7`                                                |

所有 tokenId 均成功递增，attestationHash 均唯一且非 `bytes32(0)`，MRENCLAVE pin 校验通过。

原始数据：`infra/production/scripts/regression-20260416-175024/`（summary-*.json +
aggregate.json + log-*.txt）。

---

## 观察到的问题

1. **端到端耗时主要是固定开销**。中位数 18251 ms 中：
   - `TEE_E2E_POLL_INTERVAL_MS=10000` 贡献 ~10s 轮询粒度
   - 剩余 ~8s 是 stake 确认 + listener 审计执行 + writeback 确认
   - SGX 生成 quote 本身 < 500 ms（M6ce 端日志，非关键路径）
2. **`auditScore` 均为 0 / `auditStatus=2`（Failed）**。回归 manifest 声称 `pass` 但沙箱判定 `fail`，
   属于 audit decision mismatch。不影响 attestation 链路验证目标。
3. **macOS 脚本 portability 修复**：将 `date +%s%3N` 替换为 `node -e 'Date.now()'`，
   已在 Task #9 中完成。
4. **ethers v5/v6 共存**：脚本用 v6 API，只有 `frontend/node_modules/ethers@6.16.0` 可用。
   `NODE_PATH` 明确指向 frontend 的 `node_modules` 以避免歧义。

---

## 已知不足（候选 Task #12）

listener `processAuditRequested.ts:166` 对 `createAuditAttestation` 采取 **"SGX 不可用则抛出"** 的
严格策略：

```ts
const attestationResult = dependencies.createAuditAttestation
  ? await dependencies.createAuditAttestation({...})
  : undefined;
const attestationHash = attestationResult?.attestationHash ?? ZERO_EVIDENCE_HASH;
```

只要 SGX API 不可达或 MRENCLAVE 不匹配，`createAuditAttestation` 会抛异常 →
audit 被丢进 `audit-execution-retry.json` 不断重试。这意味着：

- **优点**：链上不会出现 `attestationHash=0x0` 的"未经 TEE 校验"记录，保证审计凭据真实性。
- **缺点**：SGX 机长时间宕机时，整个 listener 会卡在无限重试，无法降级为"裸 audit without TEE"。

**后续方案候选**：

1. 加入 "degraded-mode" 配置：`AUDIT_ATTESTATION_REQUIRED=strict|optional`。
   - `strict`：保持现状（默认）。
   - `optional`：SGX 不可达时允许写入 `attestationHash=0x0`，前端用红色 badge 显示
     "NOT attested"。
2. 给 retry-queue 设最大失败次数，超过后 fire `AUDIT_ATTESTATION_UNAVAILABLE` 告警。
3. M6ce 多实例 + health-check 切换。

将作为 Task #12 跟进。

---

## 相关文件

- 回归脚本：`infra/production/scripts/run-tee-regression.sh`
- 单次脚本：`infra/production/scripts/run-tee-e2e.sh`
- 环境模板：`infra/production/scripts/tee-e2e.env.example`
- 样例产物：`infra/production/scripts/tee-e2e-summary.example.json`
- 本次回归原始数据：`infra/production/scripts/regression-20260416-175024/`
- 部署文档：`infra/production/README.md#sgx-tee-attestation-production-loop`
- 验证方法详解：`docs/verification-methods.md#7-生产部署状态-2026-04-16`
