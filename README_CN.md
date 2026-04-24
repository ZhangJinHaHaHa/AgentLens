<div align="center">

# 🏓 AgentLens

**面向 AI Agent 的可信市场与链上基础设施**

[![许可证: AGPL v3](https://img.shields.io/badge/许可证-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org/)
[![Intel SGX](https://img.shields.io/badge/TEE-Intel_SGX-0071C5.svg)](https://software.intel.com/en-us/sgx)
[![ZK Proofs](https://img.shields.io/badge/ZK-Circom-8A2BE2.svg)](https://docs.circom.io/)

[官方网站]() • [项目文档](docs/) • [Agent 接入指南](docs/agent-integration-guide.md) • [架构详解](#-系统架构)

</div>

---

**AgentLens** 是一个去中心化的基础设施和交易市场，旨在解决 AI Agent 经济中的信任难题。在您雇佣或与 AI Agent 交互之前，“AgentLens”为其能力、安全边界和历史表现提供可验证的证明。

通过结合 **链上审计评分**、**Intel SGX TEE 远程验证**、**零知识证明 (ZK)** 以及 **多维动态信誉模型 (MDDRM)**，“AgentLens”确保 Agent 的可信度是可验证的，而不仅仅是口头承诺。

## 🌐 官方平台 (敬请期待)

**AgentLens Cloud** 将提供托管的审计服务、企业级的 TEE 验证和全托管的交易市场——无需您自己搭建任何基础设施。

→ **[加入候补名单]()** 获取早期访问权限。

## 🚀 核心特性

* 📊 **多维风险画像**：从安全、任务执行、认知、环境、工程、合规 6 个维度评估 Agent，生成详尽的风险画像和场景适配建议。
* 🔐 **Intel SGX TEE 存证**：所有沙箱审计均在硬件隔离的环境中运行。加密证明（MRENCLAVE）锚定在链上，确保执行过程不可篡改。
* 🛡️ **零知识证明验证**：使用 `circom` 和 `snarkjs` (Groth16/BN128) 证明审计分数的计算逻辑和 Agent 身份指纹，无需暴露开发者私有的源代码。
* ⚖️ **动态信誉系统 (MDDRM)**：链上信誉分根据审计结果、用户评价、申诉结果和时间衰减动态调整。
* 🏪 **可信交易市场**：基于 React 的前端市场，买家可以根据风险、TEE 状态、价格、任务类型浏览、筛选并租用/购买经过验证的 Agent。

## 🏗️ 系统架构

```mermaid
graph TD
    subgraph "开发者层"
        D[开发者钉包] -->|质押并提交| R
    end

    subgraph "链上层 (Polygon Edge)"
        R[审计注册表 V3] -->|触发审计事件| L
        M[Agent 交易市场]
        Rev[评价注册表]
        Z[ZK 验证器]
    end

    subgraph "链下基础设施"
        L[事件监听器] -->|调度| S
        S[Docker 沙箱] <-->|Q&A 交互| LLM[LLM 引擎]
        S <-->|执行验证| TEE[Intel SGX 节点]
        S -->|生成| ZKP[ZK 证明生成器]
        
        TEE -->|远程验证| L
        ZKP -->|Groth16 证明| L
        L -->|回写审计报告| R
    end

    subgraph "用户层"
        B[买家] -->|浏览 & 租赁| M
        B -->|发表评价| Rev
    end
```

## ⚡ 快速开始

### 环境要求

* Node.js 20+
* Docker & Docker Compose
* Rust (用于 ZK 电路编译)
* Polygon Edge 本地节点

### 本地开发

1. **安装依赖：**
   ```bash
   cd contracts && npm install
   cd ../sandbox && npm install
   cd ../frontend && npm install
   ```

2. **启动本地区块链：**
   ```bash
   cd infra/polygon-edge-local && docker compose up -d
   ```

3. **部署智能合约：**
   ```bash
   cd contracts && npx hardhat run scripts/deployV3.js --network edge_local
   ```

4. **配置并启动市场前端：**
   ```bash
   cat > frontend/.env.local << EOF
   VITE_AUDIT_RPC_URL=http://localhost:18545
   VITE_AUDIT_REGISTRY_ADDRESS=<合约部署地址>
   VITE_AUDIT_CHAIN_ID=302512
   EOF
   
   cd frontend && npm run dev
   ```

## 🧩 核心组件

### 智能合约 (`/contracts`)
* `AgentAuditRegistryV3`：实现 MDDRM 信誉系统，处理质押、审计结果、申诉和时间衰减逻辑。
* `AgentMarketplace`：管理 Agent 访问权，支持按天租赁和永久购买，并进行权限检查。
* `ZkAuditVerifier`：链上注册表，存储经过验证的审计分数和 Agent 指纹的 Groth16 证明。

### 审计沙箱 (`/sandbox`)
一个隔离的环境，通过 LLM 引擎自动评估提交的 Agent。它生成 6 维度评分，进行安全边界分析，并协调 TEE 存证和 ZK 证明生成。

### 零知识证明电路 (`/contracts/zk`)
* `AuditScoreVerifier`：证明 6 维度分数和加权总分是从原始审计数据中正确计算出来的。
* `AgentFingerprint`：在不暴露源码的前提下，证明 Agent 的身份和行为特征已绑定到特定的 NFT Token ID。

## 📖 相关文档

* [Agent 接入指南](docs/agent-integration-guide.md) - 如何构建并提交您的 Agent 进行审计。
* [验证方法论](docs/verification-methods.md) - “AgentLens”如何验证 Agent 声明的详细说明。
* [TEE 生产状态](docs/status/2026-04-16-tee-production.md) - 关于 SGX 硬件加密飞地的设置信息。

## 🛡️ 安全与信任

AgentLens 高度重视安全性。整个架构旨在最小化信任假设：
* **代码隐私**：开发者无需公开源码，通过 ZK 证明处理身份和特征验证。
* **执行完整性**：TEE 远程验证确保审计沙箱未被篡改。
* **经济安全**：MDDRM 惩罚机制对恶意或表现不佳的 Agent 进行经济制裁。

漏洞报告请参阅 [SECURITY.md](SECURITY.md)。

## 🤝 关于作者与认识 Popo 🏓

你好！我目前是一名在校学生，正在独立开发 **AgentLens**。我的目标是为 AI Agent 经济构建一个可验证的、信任优先的基础设施。

在深入 Web3 和 AI 领域之前，我曾是一名**职业乒乓球运动员**。体育竞技所要求的纪律性、精准度和快速反应，深刻地影响了我构建高可靠性系统的方式。

这段经历也启发了 AgentLens 的官方吉祥物——**Popo** 的诞生。Popo 是一颗充满活力的乒乓球，坐在乒乓球台上。它代表着敏捷、准确，以及我们的审计沙箱对 AI Agent 进行的持续“来回”验证过程。就像比赛中的裁判一样，Popo 确保每个 Agent 在进入市场之前都遵守规则。

我正在积极寻找对以下方向充满热情的 **合作者、研究人员和开源贡献者**：
* Web3 与去中心化基础设施
* AI Agent 与智能体工作流
* 零知识证明 (ZK) 与可信执行环境 (TEE)
* 智能体审计与安全

如果你对共同构建未来的可信 AI Agent 基础设施感兴趣，欢迎随时联系我！
**联系方式：** [3172791717@qq.com](mailto:3172791717@qq.com)

我们也欢迎来自社区的常规代码贡献！请阅读我们的 [CONTRIBUTING.md](CONTRIBUTING.md) 了解开发流程，并注意本项目受 [贡献者行为准则](CODE_OF_CONDUCT.md) 约束。

## 📜 开源许可与商业授权

AgentLens 采用 **GNU Affero General Public License v3.0 (AGPL-3.0)** 开源协议，适用于社区、学术研究和非商业用途。详情请参阅 [LICENSE](LICENSE) 文件。

**商业授权 (Commercial License)**：如果您希望在商业产品、闭源的 SaaS 平台或企业私有化部署中使用 AgentLens，且不希望受到 AGPL 协议（要求您开源整个服务端代码）的限制，您可以获取商业授权。

关于商业授权和企业级支持，请与我们联系。

## 📝 贡献者许可协议 (CLA)

为了确保我们能够持续以开源和商业双轨制提供 AgentLens，所有贡献者在提交 Pull Request 被合并之前，必须签署 [贡献者许可协议 (CLA)](CLA.md)。
