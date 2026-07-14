# AgentLens Platform Protocol v1

本目录是 AgentLens 托管平台的公开接入契约。开源仓库提供协议、客户端边界和审计标准；生产 Provider 配置、Brain 编排、卖家运行器、排序策略和部署信息不属于公开实现。

## 契约

| 契约 | 用途 | Schema |
|---|---|---|
| Model Provider | OpenAI Responses、Anthropic Messages、OpenAI-compatible 模型适配 | `schemas/agentlens-model-provider.v1.schema.json` |
| Search Provider | Tavily、Brave、DuckDuckGo 搜索结果归一化 | `schemas/agentlens-search-provider.v1.schema.json` |
| Seller Submission | 卖家创建商品、提交代码/API、定价和版本信息 | `schemas/agentlens-seller-submission.v1.schema.json` |
| Agent Runtime | 卖家托管 API 的最小请求/响应信封 | `schemas/agentlens-agent-runtime.v1.schema.json` |
| Market Listing | 买家可见商品与信任边界 | `schemas/agentlens-market-listing.v1.schema.json` |
| Pricing Quote | 平台大脑、卖家 Agent、平台服务费与卖家收入拆分 | `schemas/agentlens-pricing-quote.v1.schema.json` |

托管平台通过 `GET /api/protocols` 发布当前协议版本。该目录只返回能力和契约版本，不返回上游 URL、密钥或内部服务信息。

Provider 请求映射、认证边界和兼容流程见 [`provider-adapters.md`](provider-adapters.md)。卖家自助发布与文件交付的机器可读规范见 [`agentlens-seller-api.v1.openapi.json`](agentlens-seller-api.v1.openapi.json)。

## 模型与搜索边界

1. Claude、GPT 和兼容模型统一映射为 AgentLens 消息与回答对象。响应中的 `model` 始终是用户选择的平台目录 ID；上游若把别名规范化为其他名称，则另以可选 `upstreamModel` 返回。
2. OpenAI 官方接口使用 Responses；Anthropic 官方接口使用 Messages；兼容中转平台使用 OpenAI-compatible。
3. 搜索 Provider 只提供候选结果。查询重写、多轮补搜、网页精读、来源归一化和事实复核由 AgentLens Brain 完成。
4. 模型和搜索凭证只保存在托管平台服务端，浏览器和卖家 Agent 永远不能收到平台凭证。
5. 增加 Provider 只新增适配器，不改变工作区、卖家 Agent 或计费协议。

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

买家购买 Agent 的运行能力，不购买源码。买家没有源码下载接口。

## 运行与凭证

- 代码、ZIP、GitHub、Docker、CLI、MCP 和工作流由平台归一化为 OCI 镜像，锁定摘要，通过扫描、受限 smoke 与沙箱准入后按需运行。
- 卖家托管 API 只接受 HTTPS，并执行 SSRF、DNS/IP、超时、响应大小和黑盒样例检查。请求使用 `X-AgentLens-Contract-Version: agentlens.agent-runtime.v1` 协商版本。
- 平台 Provider 密钥不注入卖家容器。
- 卖家 API 密钥由服务端加密保存，持久记录只引用 `secretRef`/`secretId`，写入响应不返回原值。
- 卖家托管 API 不宣称源码已审计，也不进入平台自动推荐。

## 定价

卖家设置 1 到 10000 的整数 `costCredits`。平台费率由托管平台服务端配置，卖家不能覆盖。

```text
buyerTotal = brainAndSearchCredits + sellerAgentCredits
platformFee = sellerAgentCredits * platformFeeRateBps / 10000
sellerPayout = sellerAgentCredits - platformFee
```

调价只影响新运行；已创建运行使用已记录的费用快照。

## 版本规则

- v1 只允许向后兼容地增加可选字段。
- 删除字段、改变含义或放宽安全边界必须发布新主版本。
- 未识别的主版本必须失败关闭。
