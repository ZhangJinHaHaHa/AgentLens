<div align="center">

# 🛡️ Agent 神机 (Agent Shenji)

**面向 AI Agent 的可信市场与链上基础设施**

[![许可证: MPL 2.0](https://img.shields.io/badge/许可证-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org/)
[![Intel SGX](https://img.shields.io/badge/TEE-Intel_SGX-0071C5.svg)](https://software.intel.com/en-us/sgx)
[![ZK Proofs](https://img.shields.io/badge/ZK-Circom-8A2BE2.svg)](https://docs.circom.io/)

[官方网站]() • [项目文档](docs/) • [Agent 接入指南](docs/agent-integration-guide.md) • [架构详解](#-系统架构)

</div>

---

**Agent 神机** 是一个去中心化的基础设施和交易市场，旨在解决 AI Agent 经济中的信任难题。在您雇佣或与 AI Agent 交互之前，“神机”为其能力、安全边界和历史表现提供可验证的证明。

通过结合 **链上审计评分**、**Intel SGX TEE 远程验证**、**零知识证明 (ZK)** 以及 **多维动态信誉模型 (MDDRM)**，“神机”确保 Agent 的可信度是可验证的，而不仅仅是口头承诺。

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
        D[开发者钱包] -->|质押 & 提交| R
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
* [验证方法论](docs/verification-methods.md) - “神机”如何验证 Agent 声明的详细说明。
* [TEE 生产状态](docs/status/2026-04-16-tee-production.md) - 关于 SGX 硬件加密飞地的设置信息。

## 🛡️ 安全与信任

Agent 神机高度重视安全性。整个架构旨在最小化信任假设：
* **代码隐私**：开发者无需公开源码，通过 ZK 证明处理身份和特征验证。
* **执行完整性**：TEE 远程验证确保审计沙箱未被篡改。
* **经济安全**：MDDRM 惩罚机制对恶意或表现不佳的 Agent 进行经济制裁。

漏洞报告请参阅 [SECURITY.md](SECURITY.md)。

## 🤝 参与贡献

我们欢迎社区贡献！请阅读我们的 [CONTRIBUTING.md](CONTRIBUTING.md) 了解开发流程、如何提交 Bug 修复和改进建议。

参与本项目请遵守 [贡献者行为准则](CODE_OF_CONDUCT.md)。

## 📜 开源许可

本项目采用 Mozilla Public License 2.0 (MPL-2.0) 许可 - 详情请参阅 [LICENSE](LICENSE) 文件。
