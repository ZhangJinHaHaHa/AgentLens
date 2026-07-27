# AgentLens Public Integration Contracts

本目录发布 AgentLens 面向卖家 Agent、模型适配器、搜索适配器和运行时的机器可读契约。公开这些契约的目的，是让第三方能够独立验证接入边界，而不是公开托管平台的生产实现。

- 在线平台：[agentlens.chat](https://agentlens.chat/zh)
- 卖家 API：[`agentlens-seller-api.v1.openapi.json`](agentlens-seller-api.v1.openapi.json)
- Provider 适配说明：[`provider-adapters.md`](provider-adapters.md)

## 公开范围

| 公开 | 不公开 |
|---|---|
| Agent、Wire、Runtime、Provider、Research、Artifact、Listing 与 Pricing Schema | Brain 提示词、调度算法、模型权重与供应商选择策略 |
| 面向第三方的请求、事件、产物、错误和计量字段 | 生产 Provider 地址、密钥、配额和回退顺序 |
| 非敏感合约、前端和审计参考实现 | 生产 Worker、能力代理实现、内部质量评分与计费账本 |
| 本地测试和协议一致性检查 | 服务器地址、生产拓扑、部署脚本、运行日志和客户数据 |

协议公开不等于匿名开放生产接口。写入、执行、密钥注入和卖家管理接口始终需要服务端认证与授权。

## 契约目录

| 契约 | 用途 | Schema |
|---|---|---|
| Agent Contract v3 | Agent 卡片、任务、事件、检查点、取消/恢复和结果 | `schemas/agentlens-agent-contract.v3.schema.json` |
| Agent Wire v1 | Supervisor 与 Agent Runtime 间不携带明文密钥的双向帧 | `schemas/agentlens-wire.v1.schema.json` |
| Runtime Package v1 | 不可变入口、文件清单和内容哈希 | `schemas/agentlens-runtime-package.v1.schema.json` |
| Universal Runtime v1 | 运行平面、能力授权、Worker 绑定、持久卷、浏览器和外部资源回执 | `schemas/agentlens-universal-runtime.v1.schema.json` |
| Brain Runtime v3 | Provider-neutral 的运行回执、状态和 fallback 原因 | `schemas/agentlens-brain-runtime.v3.schema.json` |
| Build Manifest v1 | release、构建输入和产物摘要绑定 | `schemas/agentlens-build-manifest.v1.schema.json` |
| Model Provider v1 | OpenAI Responses、Anthropic Messages 与 OpenAI-compatible 的统一能力描述 | `schemas/agentlens-model-provider.v1.schema.json` |
| Model Content Part v1 | 文本、图片和文件等模型输入的哈希绑定描述 | `schemas/agentlens-model-content-part.v1.schema.json` |
| Provider Conformance v1 | 模型适配器能力、故障和一致性测试结果 | `schemas/agentlens-model-provider-conformance.v1.schema.json` |
| Search Provider v1 | 搜索候选结果归一化 | `schemas/agentlens-search-provider.v1.schema.json` |
| Research Bundle v3 | 查询、网页证据、采用/拒绝原因和内容哈希 | `schemas/agentlens-research-bundle.v3.schema.json` |
| Artifact Source Map v1 | 产物 claim、证据片段、来源和位置映射 | `schemas/agentlens-artifact-source-map.v1.schema.json` |
| Seller Submission v1 | 卖家代码/API 提交、定价和版本资料 | `schemas/agentlens-seller-submission.v1.schema.json` |
| Agent Runtime v1 | 卖家托管 API 的最小请求/响应信封 | `schemas/agentlens-agent-runtime.v1.schema.json` |
| Market Listing v1 | 买家可见商品、版本和信任边界 | `schemas/agentlens-market-listing.v1.schema.json` |
| Pricing Quote v1 | 平台能力、卖家 Agent、平台费和卖家收入快照 | `schemas/agentlens-pricing-quote.v1.schema.json` |

托管平台可通过 `GET /api/protocols` 返回当前协议版本。该响应只应包含能力和契约版本，不得返回上游 URL、凭据、内部节点或部署信息。

## R0-R4 运行平面

Universal Runtime 使用稳定的能力合同描述不同 Agent 所需的承载方式：

| 层级 | 协议平面 | 典型能力 | 当前口径 |
|---|---|---|---|
| R0 | `sealed_ephemeral` | 无网、短时、隔离文件与产物生成 | 基础平面 |
| R1 | `brokered_egress` | 经能力代理访问受控 HTTP、搜索和连接器 | 受授权与预算约束 |
| R2 | `durable_session` | 检查点、恢复、持久卷和长任务 | 按生命周期与存储计量 |
| R3 | `browser_computer` | 只读或交互式浏览器会话 | 独立隔离和逐项授权 |
| R4 | `accelerated_external` | GPU、特殊操作系统或超大存储资源 | 协议预留，暂不作为常规上架能力 |

Schema 能表达某个平面，不代表公开仓库或每个线上部署已提供该资源。具体 Agent 必须通过运行时一致性检查；不能满足的能力应失败关闭，不得静默降级或伪造成功。

## 模型、搜索与平台大脑

1. Claude、GPT 和兼容模型统一映射为 AgentLens 消息、内容部件和回答对象。用户看到的平台模型 ID 不因上游别名变化而改变；可选 `upstreamModel` 仅用于可观测性。
2. OpenAI 官方接口使用 Responses，Anthropic 官方接口使用 Messages，兼容中转服务使用 OpenAI-compatible 适配合同。
3. 搜索 Provider 只提供候选结果。查询规划、多轮补搜、网页精读、来源归一化、冲突检测和事实复核属于 AgentLens 托管能力。
4. 平台模型与搜索凭据只保存在服务端。浏览器、卖家容器、Wire 帧、运行 trace 和下载产物均不得包含平台凭据。
5. 增加 Provider 只新增适配器和一致性报告，不改变工作区、卖家 Agent、产物或计费合同。
6. 用户明确租赁的 Agent 负责垂直执行；平台大脑负责任务理解、受控能力和结果解释，不得静默替换该 Agent。

## 卖家发布 API

“公开 API”表示契约公开，并不表示匿名可写：

| 方法 | 路径 | 权限 |
|---|---|---|
| `GET` | `/api/market/agents` | 匿名只读，只返回已上架商品 |
| `GET` | `/api/my/agents` | 卖家本人 |
| `POST` | `/api/my/agents` | 卖家本人，最多 3 个未删除 Agent |
| `PATCH` | `/api/my/agents/{agentId}` | 卖家本人，可更新商品资料和价格 |
| `POST` | `/api/my/agents/{agentId}/source-artifacts` | 卖家本人，上传 ZIP |
| `GET` | `/api/my/agents/{agentId}/source-artifacts/{artifactId}/download` | 仅源码所有者取回 |
| `POST` | `/api/my/agents/{agentId}/api-secret` | 卖家本人，密钥写入后不回显 |
| `POST` | `/api/my/agents/{agentId}/submit` | 卖家本人，提交新版本审核 |
| `GET` | `/api/my/agents/{agentId}/status` | 卖家本人，读取版本与处理状态 |

买家租赁 Agent 的运行能力，不购买源码或永久所有权。买家没有源码下载接口。

## 运行与凭证

- ZIP、GitHub、Docker、CLI、MCP 和工作流可由托管平台归一化为不可变运行包或 OCI 镜像，锁定摘要并经过扫描、受限 smoke 与沙箱准入。
- 卖家托管 API 只接受 HTTPS，并应执行 SSRF、DNS/IP、超时、响应大小和黑盒样例检查。
- 平台 Provider 密钥不注入卖家容器；能力调用通过短期、最小权限授权完成。
- 卖家 API 密钥由服务端加密保存，持久记录只引用 `secretRef`/`secretId`，写入响应不返回原值。
- 卖家托管 API 不宣称源码已审计，也不自动获得平台原生 Agent 的信任等级。

## 租赁与计价

平台只提供限时租赁，不提供永久购买。链上访问权按到期时间判断；同一用户继续租赁时，可在有效期基础上延长。

卖家设置整数 `costCredits`。平台费率和平台能力单价由托管服务端配置，卖家不能覆盖。公开报价合同记录快照，但不公开内部成本、费率策略或结算账本。

```text
buyerTotal = platformCapabilityCredits + sellerAgentCredits
platformFee = sellerAgentCredits * platformFeeRateBps / 10000
sellerPayout = sellerAgentCredits - platformFee
```

`platformCapabilityCredits` 可由模型、搜索、计算和存储等公开计量项组成。调价只影响新运行；已创建运行使用其不可变报价快照，重试和返工必须遵循幂等与不重复扣费约束。

## 版本规则

- 同一主版本只允许向后兼容地增加可选字段。
- 删除字段、改变含义或放宽安全边界必须发布新主版本。
- 未识别的主版本必须失败关闭。
- 运行记录应绑定 Agent 版本、镜像或包摘要、接口版本和适配器版本，禁止静默回退旧接口。
