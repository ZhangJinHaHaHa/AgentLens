# Agent Shenji

基于 Polygon Edge 的 **AI Agent 链上信用审计与可信交易基础设施**。

开发者提交 Agent → 合约铸造 NFT → 沙箱自动审计（LLM 出题 + 6 维评分 + 安全边界分析）→ SGX TEE 存证 → 链上写回信用档案 → 前端 marketplace 展示。

## 架构概览

```
┌─────────────┐     stake()      ┌──────────────────┐
│  Developer   │ ──────────────→ │  V3 Registry     │
│  (wallet)    │                 │  (Polygon Edge)   │
└─────────────┘                 └────────┬─────────┘
                                         │ AuditRequested event
                                         ▼
                                ┌──────────────────┐
                                │  Listener         │
                                │  (Node.js)        │
                                └────────┬─────────┘
                                         │
                        ┌────────────────┼────────────────┐
                        ▼                ▼                ▼
               ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
               │  Sandbox     │ │  LLM Engine  │ │  SGX TEE     │
               │  (Docker)    │ │  (gpt-5.4)   │ │  (M6ce)      │
               └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
                      │                │                │
                      └────────────────┼────────────────┘
                                       ▼
                              ┌──────────────────┐
                              │  recordAuditV2() │  → 链上回写
                              │  + attestation   │  → 前端查询
                              └──────────────────┘
```

## 目录结构

```
agent-shenji/
├── contracts/          # Solidity 合约 (Hardhat)
│   ├── src/            # V1/V2/V3 Registry + Marketplace + ReviewRegistry
│   ├── artifacts/      # 编译产物 ABI
│   ├── scripts/        # 部署脚本
│   └── test/           # 合约测试 (22 pass)
├── sandbox/            # 审计沙箱 (Node.js / TypeScript)
│   ├── src/audit/      # LLM 出题 + 6 维评分 + 安全边界分析
│   ├── src/listener/   # 事件监听 + 链上写回
│   ├── src/cli/        # CLI 工具 (listener, agentRegistry, verify...)
│   ├── src/attestation/# SGX TEE 存证
│   ├── src/appeal/     # 申诉链上写入
│   └── src/review/     # 评论存储 + API
├── frontend/           # 前端 (React + Vite + TypeScript)
│   ├── src/pages/      # 3 个页面 (Home, AgentDetail, AuditReport)
│   ├── src/components/ # 30+ 组件
│   ├── src/hooks/      # 数据 hooks
│   └── src/lib/        # 合约客户端 + 工具
├── infra/              # 基础设施
│   ├── production/     # 生产部署 (docker-compose + nginx)
│   ├── attestation/    # SGX attestation 服务
│   └── polygon-edge-*/ # Polygon Edge 节点
└── docs/               # 文档
```

## 核心合约

| 合约 | 功能 |
|------|------|
| **AgentAuditRegistryV3** | MDDRM 多维动态信誉模型。stake → 审计 → 6 维评分 → 申诉 → 信誉积分（时间衰减） |
| **AgentMarketplace** | Agent 访问权交易。租用（按天）/ 购买（永久）+ 权限检查 |
| **AgentReviewRegistry** | 链上评价。6 维二值评分 + SHA-256 hash 校验链下评论 |

### 信誉模型 (MDDRM)

- 审计通过：+50 分
- 申诉成功：+100 分
- 申诉失败：-200 分
- 时间衰减：1%/30 天
- 满分：10,000

## 6 维能力评估

| 维度 | 权重 | 来源 |
|------|------|------|
| Security | 25% | 安全类题目 + 边界得分 + 越权检测 |
| Task Execution | 20% | 功能题评分 + healthcheck |
| Cognitive | 15% | 答案质量 + 推理清晰度 |
| Environment | 15% | 鲁棒性题评分 + 错误处理 |
| Engineering | 15% | 性能题评分 + 资源指标 |
| Compliance | 10% | 网络对账 + 允许边界 |

工具类 Agent 额外增加 4 维：api_reliability / data_accuracy / latency / error_recovery。

## 前端功能

- **Marketplace 首页** — 浏览已审计 Agent + 风险等级/TEE 验证/定价筛选
- **Agent 详情页** — 信誉徽章 + 风险画像（场景适配推荐）+ 信任担保流程 + 定价 + 审计历史 + 评论
- **审计报告页** — 6 维雷达图 + 安全边界分析 + LLM Q&A 展示 + TEE attestation 验证
- **场景适配** — 基于维度分数推荐 DeFi/客服/DevOps/数据分析/通用 5 种场景

## ZK 零知识证明

项目使用 **circom + snarkjs (Groth16 / BN128)** 实现两类 ZK 证明：

### 电路

| 电路 | Constraints | 用途 |
|------|-------------|------|
| **AuditScoreVerifier** | 1,673 | 证明 6 维评分从原始数据正确计算 |
| **AgentFingerprint** | 1,754 | 证明 Agent 身份绑定 NFT，不泄露代码 |

### AuditScoreVerifier

证明审计评分的完整性：
- 每个维度分数 = 该类别题目评分的正确平均值
- Engineering 分数 = CPU/内存阈值的正确映射
- Overall 分数 = 6 维加权平均（权重 2500/2000/1500/1500/1500/1000）
- 所有分数在 [0, 100] 范围内
- Poseidon 承诺绑定私有输入

### AgentFingerprint

证明 Agent 身份而不暴露源码：
- 指纹 = Poseidon(manifestHash, codeHash, behavioralTraits, tokenId)
- 开发者身份 = Poseidon(developerSecret, tokenId)
- 行为特征验证（网络访问、认证需求、内存层级、API 复杂度）
- 所有输入绑定到特定 tokenId

### 合约

| 合约 | 功能 |
|------|------|
| `AuditScoreVerifierVerifier_Groth16.sol` | snarkjs 自动生成的评分验证器 |
| `AgentFingerprintVerifier_Groth16.sol` | snarkjs 自动生成的指纹验证器 |
| `ZkAuditVerifier.sol` | 链上注册表，存储已验证的 proof 结果 |

### 编译电路

```bash
# 前置：安装 Rust + circom
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install --git https://github.com/iden3/circom.git
npm install -g snarkjs

# 编译（生成 WASM + proving key + Solidity verifier）
cd contracts/zk && npm install && npm run compile
```

### Proof 生成

```typescript
import { generateAuditScoreProof } from "./zk/generateAuditScoreProof";

const proof = await generateAuditScoreProof({
  dimensionalScores: [85, 70, 65, 80, 90, 75],
  overallScore: 78,
  categoryScores: [[85, 80], [70], [65], [80, 85], [], [75]],
  categoryCounts: [2, 1, 1, 2, 0, 1],
  cpuAvgMilli: 300,
  memoryPeakMb: 128,
  complianceScore: 75,
  securityBoundaryScore: 85
});
// proof.verified === true
```

环境变量 `ZK_PROOF_ENABLED=true` 启用审计流水线中的自动 proof 生成。

## 快速开始

### 前置条件

- Node.js 20+
- Docker
- 一个 Polygon Edge 节点

### 本地开发

```bash
# 1. 安装依赖
cd contracts && npm install
cd ../sandbox && npm install
cd ../frontend && npm install

# 2. 启动本地 Polygon Edge
cd infra/polygon-edge-local && docker compose up -d

# 3. 部署合约
cd contracts && npx hardhat run scripts/deployV3.js --network edge_local

# 4. 配置前端环境
cat > frontend/.env.local << EOF
VITE_AUDIT_RPC_URL=http://localhost:18545
VITE_AUDIT_REGISTRY_ADDRESS=<部署后的合约地址>
VITE_AUDIT_CHAIN_ID=302512
EOF

# 5. 启动前端
cd frontend && npm run dev
```

### Agent Registry CLI

```bash
cd sandbox

# 搜索 agent
npm run run:agent:search -- --batch-size 10 --agent-name-contains risk

# 读取最新审计
npm run run:agent:get-report -- --token-id 1

# 浏览历史审计
npm run run:agent:history -- --token-id 1 --offset 0 --limit 5

# 验证报告/存证/attestation
npm run run:agent:verify -- report --event-key <txHash>:<logIndex>
```

详见 [TRUSTED-AGENT-SKILL.md](docs/TRUSTED-AGENT-SKILL.md)。

## 生产部署

4 个 Docker 容器通过 `infra/production/docker-compose.yml` 编排：

| 服务 | 功能 | 端口 |
|------|------|------|
| shenji-listener | 事件监听 + 沙箱审计 + 链上写回 | 内部 |
| shenji-report-gateway | 审计报告 HTTP 网关 | 3310 |
| shenji-appeal-api | 申诉 API | 3312 |
| shenji-frontend | nginx 反代 + React SPA | 80 |

```bash
# 同步代码到服务器
rsync -avz --delete \
  --exclude '.git' --exclude 'node_modules' --exclude 'dist' \
  -e "ssh -p 23205" \
  ./ root@<server>:/root/agent-shenji/

# 恢复 .env 后构建部署
cd infra/production
docker compose build --no-cache
docker compose up -d
```

### SGX TEE 链路

- Attestation API: `http://<sgx-host>:3311/attest`
- MRENCLAVE 固定在 listener 内联校验
- `report_data = sha256(eventKey || manifestHash || evidenceRoot)`

## Agent 接入

开发者构建符合审计协议的 Docker 镜像，实现两个 HTTP 端点：

```
GET  /audit/health   → { "status": "ok" }
POST /audit/solve    → { "answer": "...", "actions": [...] }
```

详见 [Agent 接入指南](docs/agent-integration-guide.md)。

## 测试

```bash
# 合约测试 (22 pass)
cd contracts && npx hardhat test

# 沙箱测试
cd sandbox && npm test

# 前端测试
cd frontend && npx vitest run

# 前端类型检查
cd frontend && npx tsc --noEmit
```

## 技术栈

- **合约**: Solidity 0.8.24 + Hardhat + ethers.js v5
- **沙箱**: Node.js 20 / TypeScript / Docker CLI
- **前端**: React 18 + Vite + TypeScript + ethers.js v6 + recharts
- **链**: Polygon Edge (Chain ID 302612)
- **TEE**: Intel SGX DCAP v3 (Gramine)
- **LLM**: OpenAI Responses API (gpt-5.4-pro)

## 许可

MIT
