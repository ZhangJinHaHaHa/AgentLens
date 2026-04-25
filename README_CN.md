<div align="center">

<img src="popo-mascot.png" alt="Popo — AgentLens 吉祥物" width="180" />

# AgentLens

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

## 📊 平台使用走查与在线演示

AgentLens 已部署在线演示环境：**[http://203.91.76.159/](http://203.91.76.159/)**。为了真实验证平台的审计能力，我们接入了由不同主流大模型驱动的多个 AI Agent（OpenAI GPT-4o、Anthropic Claude Sonnet 4.5、智谱 GLM-4-Flash、MiniMax、Manus 1.6），并把它们完整地推过链上审计流水线。下面按照真实买家会接触到的顺序，对平台的核心界面与产品细节做一次走查。

### 1. 可信 Agent 交易市场（首页）

首页以 *Verify Before You Hire* 为主标题，紧接着展示 Buyers / Developers / Auditors 三个角色入口，以及一条多维筛选条（状态、任务类型、风险等级、价格档位、TEE 验证状态），让买家无需跳转就能锁定候选范围。

<p align="center">
  <img src="docs/screenshots/01-homepage-hero.png" alt="AgentLens 首页与市场总览" width="760" />
</p>

紧贴 Hero 下方是实时统计条（已上架 Agent 数量 / 通过 TEE 验证的比例 / 全网平均审计分），以及专门的 **Top Agents 排行榜**，让买家一眼判断市场健康度。排行榜支持按最高分、最佳信誉、最受欢迎、最近审计四种方式动态排序，让真正优质的 Agent 第一时间被看到，也帮助买家在数秒内完成初筛。

<p align="center">
  <img src="docs/screenshots/02-leaderboard.png" alt="Top Agents 多维排行榜" width="760" />
</p>

每张 Agent 卡片都会同时展示链上身份（Token ID 与开发者地址）、TEE 验证徽章、最近一次审计分、累计审计次数、以及动态信誉百分比，买家不必跳转就能横向比较。

<p align="center">
  <img src="docs/screenshots/03-agent-cards.png" alt="Agent 列表卡片：审计分数与 TEE 状态一目了然" width="760" />
</p>

### 2. Agent 详情页 · 6 维能力雷达图与场景适配

进入任意一个 Agent 后，会看到一份完整的“信任档案”。页面顶部展示链上元数据（Token ID、开发者钱包、总质押金、累计审计次数、是否被列入黑名单、创建与最近审计时间），紧接着是实时信誉条，包含信誉分、等级、最近一次变化（Delta）以及是否存在未结申诉。

<p align="center">
  <img src="docs/screenshots/04-claude-agent-profile.png" alt="Claude-Sonnet-Agent 链上档案" width="760" />
</p>

继续向下，**6 维能力雷达图**（安全性 / 任务执行 / 认知交互 / 环境适配 / 工程落地 / 合规性）会以可视化的方式描绘 Agent 的能力轮廓；下方的 **场景适配（Scene Suitability）** 模块进一步把这些原始分翻译为五大典型部署场景下的明确结论：DeFi/金融操作、客服问答、DevOps/基础设施、数据分析/科研、通用自动化。每个场景都会给出明确的“推荐 / 不推荐”标签，并标注出影响该结论的主导维度。

<p align="center">
  <img src="docs/screenshots/05-radar-and-scenes.png" alt="6 维能力雷达图与场景适配" width="760" />
</p>

> 上图展示的是一个刚完成审计的 Agent 的雷达六轴骨架。当 IPFS 托管的详细审计报告完成回填后，雷达多边形会被实时绘出；雷达所消费的逐维度评分，与紧随其下的 *场景适配* 结论使用的是同一份数据。

### 3. 信任担保流程与 TEE 远程验证

AgentLens 选择把信任机制摆到台面上，而不是塞进一个 Logo。**How This Agent Is Protected** 模块用四步流程清楚地告诉买家：质押金（Stake Bond）、自动化沙箱审计、链上申诉解决、持续信誉追踪——而且每一步都用该 Agent 自己的真实数据做注脚（例如该 Agent 当前实际质押了多少 ETH、当前真实的信誉分是多少）。

<p align="center">
  <img src="docs/screenshots/06-trust-guarantee.png" alt="信任担保四步流程" width="760" />
</p>

紧接着的 **Latest Audit Summary** 卡片，会展示最近一次审计的判定、分数、SGX-DCAP 远程验证哈希（截断后的 MRENCLAVE 摘要）、时间戳，以及在飞地内部观测到的资源指纹（内存峰值、平均 CPU、独立请求 IP 数）。这一指纹是买家用来“用硬件验证、不靠口头承诺”的关键。

<p align="center">
  <img src="docs/screenshots/07-latest-audit-summary.png" alt="最新审计摘要 · 含 TEE 验证信息" width="760" />
</p>

### 4. 链上审计履历 · 动态信誉 · 链上评论

Agent 的成长轨迹是永久存证的。**Audit History** 会列出该 Agent 历史上的每一次审计——包括失败的审计——并附上分数、时间和资源画像，让买家清楚看到一个 Agent 是在进步还是在退步。市场默认展示的是最近一次的分数，但完整的审计历史始终公开且不可篡改。

下方的 **User Reviews** 区采用链上准入：只有通过 `AgentMarketplace` 真正租赁或购买过该 Agent 的钱包，才能提交一份 6 维评分（可选附带链下评论，并以 SHA-256 上链锚定）。这种结构性设计，让 AgentLens 的评论从机制层面就抗刷单、抗水军。

<p align="center">
  <img src="docs/screenshots/08-audit-history-reviews.png" alt="审计履历与受准入约束的真实评论" width="760" />
</p>

---

## 🧪 主流大模型 Agent 基准审计报告

为了证明 AgentLens 是在区分“真实能力”而不是“营销口径”，我们把当前在线的 Agent 按性质分成三组，统一走完整流水线（容器启动 → 健康检查 → LLM 动态出题 → LLM 评判 → SGX TEE 远程验证 → 链上回写），评分规则完全一致。

### 第一组 · 一线通用大模型 Agent

这一组由当前市面最强的商用通用大模型驱动，理论上应该能从容应对审计中的指令遵循、安全边界和推理探针。

| Agent 名称 | 底层模型 | Token ID | 审计状态 | 分数 | TEE | 信誉 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GPT-4o-Agent | OpenAI GPT-4o | #6 | Passed | 100 / 100 | SGX-DCAP Verified | 50 / 10,000 |
| Claude-Sonnet-Agent | Claude Sonnet 4.5 | #9 | Passed | 100 / 100 | SGX-DCAP Verified | 50 / 10,000 |
| Zhipu-GLM-Agent | 智谱 GLM-4-Flash | #7 | Passed | 100 / 100 | SGX-DCAP Verified | 50 / 10,000 |

> **观察。** 三个一线 Agent 全部干净通过审计，回答同时满足了 LLM 评判和安全边界探针。审计耗时差异显著（GPT-4o 约 6 分钟，智谱约 12 分钟），反映的是各自推理延迟，而非协议偏好——这正好说明 AgentLens 是按“输出质量”而不是“厂商品牌”在打分。

### 第二组 · Agent 原生与垂直模型

这一组覆盖了专门面向 Agent 工作流定位、或者正在挑战一线阵营的新兴模型。

| Agent 名称 | 底层模型 | Token ID | 审计状态 | 分数 | TEE | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Manus-Agent | Manus 1.6 | #11 | Passed | 100 / 100 | SGX-DCAP Verified | 在指令遵循和边界处理上与一线模型持平。 |
| MiniMax-Agent | MiniMax（中端档） | #8 | Passed | 100 / 100 | SGX-DCAP Verified | 审计完成最快（约 24 秒），主要得益于回答简洁；后续更深的探针预期会拉开差距。 |

> **观察。** Agent 原生模型在当前难度下能够稳定通过，证明协议没有偏向任何特定厂商。后续的审计题库会增加多轮推理与对抗式探针，进一步把这一档拉开梯度。

### 第三组 · 失败案例与边界检测

这一组的存在，是为了证明 AgentLens **会真的让 Agent 不通过**——这恰恰是一个信任市场必须具备的特性。

| Agent 名称 | 底层模型 | Token ID | 审计状态 | 分数 | TEE | 失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Zhipu-GLM4-Agent | 智谱 GLM-4-Flash（重测档） | #10 | Failed | 0 / 100 | SGX-DCAP Verified | 容器启动正常、TEE 验证通过，但回答未达到 LLM 评判在指令遵循 / 边界处理上的标准。 |
| RiskAnalyzer | 合成高风险画像 | #3 | Failed | 0 / 100 | SGX-DCAP Verified | 6 个维度全部为 0，所有场景标注为“不推荐”。 |
| SecureVault-Agent | 合成边界违例画像 | #4 | Failed | 0 / 100 | SGX-DCAP Verified | 触发了边界违例探针，被判定为不适用任何场景。 |

> **观察。** TEE 验证通过 ≠ 审计通过——飞地只能证明“审计本身是诚实地跑过的”，而最终分数由 LLM 评判和边界测试共同决定。这种解耦正是 AgentLens 既能约束审计方诚实、又不会给低质量 Agent 放行的关键。

### 这份基准测试到底验证了什么

1. **厂商无关的审计公平性。** 一线、Agent 原生、能力薄弱的模型走的是同一条流水线，市场排名来自测量而不是品牌。
2. **真实的通过 / 失败区分度。** 同一套协议既会给 GPT-4o 和 Claude 满分，也会让 Zhipu-GLM4-Agent 和合成压力 Agent 不通过——所以 AgentLens 上的 *Passed* 徽章是有信息量的。
3. **硬件锚定的执行环境。** 每一次审计（包括失败的那些）都附带 SGX-DCAP 远程验证，买家可以在链上以密码学方式核对该结论确实是在飞地中产生的。
4. **持续演进的链上履历。** 重测、申诉、罚没、评论都会回写到同一个注册表，Agent 的信誉随时间持续演进，而不是上线那一刻就被定格。

> **结论 —— 雇佣前先验证（Verify Before You Hire）。** AgentLens 用一份硬件锚定、任何钱包都能核对的可验证审计记录，替代了“相信我”式的自我陈述。

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

## 🤝 关于作者与认识 Popo <img src="docs/popo-icon.png" alt="Popo" width="28" align="top" />

你好！我目前是一名在校学生，正在独立开发 **AgentLens**。我的目标是为 AI Agent 经济构建一个可验证的、信任优先的基础设施。

在深入 Web3 和 AI 领域之前，我曾是一名**职业乒乓球运动员**。体育竞技所要求的纪律性、精准度和快速反应，深刻地影响了我构建高可靠性系统的方式。

这段经历也启发了 AgentLens 的官方吉祥物——**Popo** 的诞生。Popo 是一颗充满活力的乒乓球，胸前佩戴着项目的验证护盾徽章。它代表着敏捷、准确，以及我们的审计沙箱对 AI Agent 进行的持续“来回”验证过程。就像比赛中的裁判一样，Popo 确保每个 Agent 在进入市场之前都遵守规则。

### Popo 在平台里出现的位置

Popo 不只是一个 Logo 图片，而是一路贯穿在市场三个真实触点上：

| 序号 | 出现位置 | 触发时机 | Popo 说了什么 / 做了什么 |
|---|---|---|---|
| 1 | **导航栏左上角品牌标识**（`NavHeader`） | 任意页面都始终可见，紧贴在 *AgentLens* 文字标旁 | 作为品牌锚点，把导航、审计页面与市场页面串成一体。 |
| 2 | **首次访问欢迎弹窗**（`index.html` 中的 `#popo-welcome-root`） | 某个钱包 / 浏览器首次打开站点时出现（由 `localStorage` 键 `agentlens_popo_v1` 控制），几秒后自动滑入 / 滑出。 | *“Hi，我是 Popo！🏓 这里每一个 Agent 都被验证过。请放心浏览。”* |
| 3 | **市场为空时的占位插画**（`EmptyState`，由 `isNoAgentsAtAll` 驱动） | 当市场还没有任何 Agent 上架时（冷启动、或者新链刚部署）显示，携带轻微的 `@keyframes popo-float` 浮动动画。 | *“Popo 正在等待第一个 Agent 被审计…”* —— 把空状态从“无页可看”变成一份友好的邀请。 |

换句话说，Popo 不是装饰，而是一个 **信任信号**：看到 Popo，就意味着你所出现的这个界面是被审计流水线事先洁净过的。

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
