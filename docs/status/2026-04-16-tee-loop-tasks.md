# TEE 生产闭环 12 项任务完成清单 — 2026-04-16

## 总览

本次交付完成 **SGX DCAP v3 attestation 生产链路端到端闭环**，从 listener 调用 SGX
Attestation API 到 `attestationHash` 上链、前端 UI 展示，形成完整信任链。

| 维度 | 值 |
|------|-----|
| 计划项总数 | 13 |
| 已完成 | **12** |
| 可选未做 | 1（#12 SGX 宕机降级策略，已有备忘） |
| 回归成功率 | **10/10** |
| 端到端中位数耗时 | 18.25 s |
| p95 耗时 | 18.66 s |

---

## 完成清单

### #1 修复 listener V2 writeback calldata 编码

**问题**：生产 listener 向 V2 合约写回时使用 V1 的 `recordAuditResult` selector，触发
"unknown selector" revert。

**解决**：
- 新增 V2 ABI 加载：`sandbox/src/listener/auditRegistryArtifact.ts`
- 切换写回入口为 `recordAuditResultV2(tokenId, score, manifestHash, reportHash, reportCID, attestationHash, DimensionalScores)`
- 补充单元测试 `sandbox/tests/listener/writeAuditResult.test.ts`

**交付 commit**：`9240efb feat(sandbox): enforce MRENCLAVE pin and fix V2 writeback calldata`

---

### #2 确认并切换生产环境合约地址到 V2

**动作**：
- `AUDIT_REGISTRY_ADDRESS`：`0xa513...C853` (V1) → `0x4A67...5319` (V2)
- 新增 `AUDIT_REGISTRY_V2_ADDRESS` 支持申诉链上写入 (`APPEAL_CHAIN_WRITER_ENABLED=true`)
- 更新 `infra/production/.env.example` 示意两者可指向同一 V2 合约
- 核对 `memory/deployment.md` 中切换注意事项

**交付 commit**：`279ec99 feat(infra): add standalone attestation service and production TEE E2E scripts`

---

### #3 打包 Attestation API 服务 Docker 镜像与独立 compose

**产出**：`infra/attestation/`
- `Dockerfile`（基于 Gramine 1.9 + Node.js 20）
- `docker-compose.yml`（独立部署到 SGX 宿主）
- `entrypoint.sh`（gramine-sgx 包装 + signing 流程）
- `README.md`（完整操作文档）
- `.env.example`（服务配置示例）

**交付 commit**：`279ec99` + `874168e chore(infra): add attestation service env example`

---

### #4 M6ce 服务器构建 Gramine SGX enclave 并记录 MRENCLAVE

**动作**：
- 在 M6ce (`43.134.90.165`) 执行 `make SGX=1`，生成 `generate-quote.manifest.sgx`
- 记录 MRENCLAVE：`1656d0e5f1dbac0e687662f79b8b5bf8629e40224567ecb823d1eb409f0b16b8`
- 该值作为生产 listener + 前端共同 pin 的锚点

**部署文档**：`infra/attestation/README.md` + `memory/servers.md#1-tencent-cloud-m6ce`

---

### #5 M6ce 启动 Attestation API 服务（command mode）

**启动参数**：
```bash
AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE=command
AUDIT_ATTESTATION_COMMAND=/home/ubuntu/agent-shenji-sgx/run-quote.sh
AUDIT_ATTESTATION_COMMAND_PROVIDER_TYPE=sgx-dcap
AUDIT_ATTESTATION_SERVICE_HOST=0.0.0.0
AUDIT_ATTESTATION_SERVICE_PORT=3311
```

**验证**：`curl http://43.134.90.165:3311/attest` 返回非零 quote。

---

### #6 打通生产机 ↔ M6ce 的网络与鉴权

**动作**：
- 开放 M6ce 安全组 `3311` 端口（2026-04-11）
- 生产机 (`203.91.76.159`) 直连 M6ce 无代理
- listener `AUDIT_ATTESTATION_API_URL=http://43.134.90.165:3311/attest` 生效

---

### #7 给生产 listener 配置 attestation 客户端环境变量

**新增 listener 环境变量**（全部在生产 `.env` 中落地）：

| 变量 | 值 |
|------|-----|
| `AUDIT_ATTESTATION_API_URL` | `http://43.134.90.165:3311/attest` |
| `AUDIT_ATTESTATION_PROVIDER_TYPE` | `sgx-dcap-v3-gramine` |
| `AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE` | `sgx-dcap` |
| `AUDIT_ATTESTATION_EXPECTED_MEASUREMENT` | `1656d0e5…0b16b8` |
| `AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT` | `sgx-dcap-v3` |
| `AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING` | `true` |

**Online 校验**（在 `sandbox/src/attestation/httpAttestationClient.ts` 中实现）：
- 每次 `/attest` 响应都用 `buildPerRequestQuoteValidator()` 组合
  `ExpectedFieldValidator + SgxDcapQuoteValidator`
- 强制 `report_data == sha256(eventKey ‖ manifestHash ‖ evidenceRoot)`
- 任何不匹配会让 audit 失败 + `attestationHash=bytes32(0)`

**交付 commit**：`9240efb`

---

### #8 前端新增 Attestation 校验展示组件

**产出**：
- `frontend/src/components/AttestationBadge.tsx` — 小 badge（verified / not attested）
- `frontend/src/components/AttestationBadge.test.tsx` — 6 vitest 用例全通过
- `frontend/src/components/AttestationVerificationCard.tsx` — 完整 card（附 pinned MRENCLAVE）
- 集成到 `LatestAuditSummary.tsx` + `AuditReportPage.tsx`
- `frontend/src/config/appConfig.ts` 消费 `VITE_AUDIT_ATTESTATION_EXPECTED_*`
- `frontend/src/lib/agentAuditRegistryClient.ts` 读取 V2 `attestationHash`

**Docker 构建期注入**：`infra/production/Dockerfile` + `docker-compose.yml` 增加 4 个
`VITE_AUDIT_ATTESTATION_EXPECTED_*` build-arg，确保 MRENCLAVE 烘焙进 JS bundle。

**交付 commit**：`987ba79 feat(frontend): add SGX attestation verification UI`

---

### #9 编写 TEE 生产链路 E2E 冒烟脚本

**产出**：`infra/production/scripts/`
- `run-tee-e2e.sh`（单次冒烟：stake → poll → assert attestationHash != 0）
- `tee-e2e.env.example`（环境变量模板）
- `tee-e2e-summary.example.json`（首次成功样例：tokenId=1, attestationHash=`0x2f2a5d4e…`, block=901391）

**关键坑位（已修复）**：
- node heredoc 内 env 变量需显式 `export`
- macOS `date +%s%3N` 返回非数值，改用 `node -e 'Date.now()'`
- ethers 仅 `frontend/node_modules` 有 v6，通过 `NODE_PATH` 指向

**交付 commit**：`279ec99`

---

### #10 更新 TEE 部署与使用文档

**批量刷新**：
- `infra/production/README.md` — 新增完整 "SGX TEE Attestation (Production Loop)" 章节
- `docs/verification-methods.md` — 新增 "7. 生产部署状态 (2026-04-16)"
- `memory/servers.md` — 更新 M6ce + 生产机部署情况 + TEE 闭环 pin
- `memory/deployment.md` — 新增 attestation 环境变量 + 冒烟命令
- `memory/architecture.md` — 新增 "Online 校验（listener 内联）" + "前端展示"
- `memory/MEMORY.md` — Current Status 新增 SGX TEE 闭环

**交付 commit**：`880ffb0 docs: document production TEE loop and add upline report`

---

### #11 回归测试并验证 TEE 闭环稳定性

**产出**：
- `infra/production/scripts/run-tee-regression.sh`（循环 N 次 + 聚合统计）
- `infra/production/scripts/regression-20260416-175024/`（10 × summary + log + aggregate）
- `docs/status/2026-04-16-tee-production.md`（完整上线报告）

**结果**：

| 指标 | 值 |
|------|-----|
| 迭代 | 10 |
| 成功 | **10** |
| 失败 | 0 |
| attestationHash 非零次数 | **10** |
| elapsed 中位数 | 18251 ms |
| elapsed p95 | 18657 ms |
| tokenId 范围 | 3–12（连续） |

所有 attestationHash 唯一且非 `bytes32(0)`，MRENCLAVE pin 校验通过。

**交付 commit**：`279ec99` + `880ffb0`

---

### #13 部署 listener V2 calldata 修复到生产环境

**动作**：
- rsync 同步代码到 `/root/agent-shenji/`（排除 `.git/node_modules/dist`）
- 从运行容器恢复 `.env`（rsync `--delete` 会删）
- `docker compose build --no-cache`（~2min，nohup 后台）
- `docker compose up -d` 重启
- 验证 4 个 shenji 容器全部 healthy
- 验证 attestationHash 成功上链（Task #11 的 10 次成功回归已证明）

---

## 跳过（可选）

### #12 SGX 机宕机时的降级策略设计

**当前行为**：`createAuditAttestation` 抛异常 → audit 进 retry-queue 无限重试。

**候选方案**（已记入 `docs/status/2026-04-16-tee-production.md`）：
1. `AUDIT_ATTESTATION_REQUIRED=strict|optional` 开关
2. retry-queue 最大重试次数 + `AUDIT_ATTESTATION_UNAVAILABLE` 告警
3. M6ce 多实例 + health-check 切换

---

## 生产拓扑（最终）

```
┌──────────────────────────────────────────────┐
│  203.91.76.159  (ecs6824 / Tencent Cloud)    │
│  ┌────────────────────────────────────────┐  │
│  │ shenji-listener  (docker, healthy)     │  │
│  │   → httpAttestationClient              │  │
│  │   → MRENCLAVE + report_data 校验       │──┼──┐
│  └────────────────────────────────────────┘  │  │
│  ┌────────────────────────────────────────┐  │  │
│  │ shenji-report-gateway (3310)           │  │  │
│  │ shenji-appeal-api     (3312)           │  │  │
│  │ shenji-frontend       (80)             │  │  │
│  └────────────────────────────────────────┘  │  │
│  ┌────────────────────────────────────────┐  │  │
│  │ polygon-edge-external  (18545)         │  │  │
│  │   chainId=302612                       │  │  │
│  │   V2 Registry 0x4A67…5319              │  │  │
│  └────────────────────────────────────────┘  │  │
└──────────────────────────────────────────────┘  │
                                                  │ HTTP
                                                  ▼
┌──────────────────────────────────────────────┐
│  43.134.90.165  (M6ce / SGX 宿主)             │
│  ┌────────────────────────────────────────┐  │
│  │ attestationApi.ts (3311)               │  │
│  │   → gramine-sgx ./generate-quote       │  │
│  │   MRENCLAVE 1656d0e5…0b16b8            │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

---

## 相关索引

| 主题 | 路径 |
|------|------|
| 生产部署 | `infra/production/README.md` |
| SGX 服务 | `infra/attestation/README.md` |
| 验证方法 | `docs/verification-methods.md` |
| 上线报告 | `docs/status/2026-04-16-tee-production.md` |
| 回归脚本 | `infra/production/scripts/run-tee-regression.sh` |
| 冒烟脚本 | `infra/production/scripts/run-tee-e2e.sh` |

---

## 推送记录

| Commit | 主题 |
|--------|------|
| `9240efb` | feat(sandbox): enforce MRENCLAVE pin and fix V2 writeback calldata |
| `987ba79` | feat(frontend): add SGX attestation verification UI |
| `279ec99` | feat(infra): add standalone attestation service and production TEE E2E scripts |
| `880ffb0` | docs: document production TEE loop and add upline report |
| `874168e` | chore(infra): add attestation service env example |

已推送到 `origin/main`。
