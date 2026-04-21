---
name: trusted-agent-skill
description: Claude/Cursor 等 AI 助手调用 Agent Shenji CLI 进行 agent 搜索、可信摘要读取、历史审计回看与可信材料验证的工作流说明。
type: reference
version: 0.1.0
author: Trusted-Agent-Marketplace
license: MIT
repository: https://github.com/ZhangJinHaHaHa/Trusted-Agent-Marketplace
tags:
  - web3
  - blockchain
  - agent-audit
  - trust
  - aivs
  - cli
  - verification
requires:
  - node>=20
  - npm
entrypoint:
  type: cli
  workdir: sandbox
  commands:
    - npm run run:agent:registry -- <get-report|search|history|verify> [...args]
---

# Trusted Agent Skill

## Purpose

把 `sandbox` 中已经存在的 CLI 执行层组织成 AI 助手可直接复用的操作规范：

- 先 `search` 筛选候选 agent
- 再 `get-report` 读取最新或指定历史审计摘要
- 用 `history` 分页回看历史审计轨迹
- 最后 `verify` 验证报告、存证或 attestation

这个 Skill 只描述何时调用什么命令、如何解释返回结果，不重复实现底层逻辑。

## Tool contract

### 1. 搜索候选 agent

```bash
npm run run:agent:search -- --batch-size 10 --agent-name-contains risk --status 2 --min-score 80
```

返回一行 JSON：

```json
{
  "status": "ok",
  "filters": {
    "startTokenId": 1,
    "batchSize": 10,
    "maxConsecutiveNotFound": 5,
    "agentNameContains": "risk",
    "status": 2,
    "minScore": 80
  },
  "agents": [
    {
      "tokenId": "1",
      "agentName": "risk-agent",
      "developer": "0x...",
      "totalBond": "1000",
      "blacklisted": false,
      "auditCount": 2,
      "latestStatus": 2,
      "latestScore": 92
    }
  ],
  "nextScanTokenId": "11",
  "consecutiveNotFound": 0,
  "hasMore": true
}
```

### 2. 读取 agent 可信摘要

读取最新摘要：

```bash
npm run run:agent:get-report -- --token-id 1
```

读取指定历史审计：

```bash
npm run run:agent:get-report -- --token-id 1 --audit-id 7
```

不带 `--audit-id` 时返回一行 JSON（latest 模式）：

```json
{
  "status": "ok",
  "tokenId": "1",
  "profile": {
    "developer": "0x...",
    "agentName": "risk-agent",
    "tokenId": "1",
    "totalBond": "1000",
    "blacklisted": false,
    "createdAt": 1710000000,
    "lastAuditAt": 1710000100,
    "auditCount": 1
  },
  "latestAuditReport": {
    "auditId": 1,
    "timestamp": 1710000100,
    "auditScore": 92,
    "status": 2,
    "reportCID": "bafy-report",
    "manifestUrl": "https://example.com/manifest.json",
    "appealRequested": false,
    "appealApproved": false
  }
}
```

指定 `--audit-id` 时，返回结构中的审计字段变为 `auditReport`：

```json
{
  "status": "ok",
  "tokenId": "1",
  "auditId": 7,
  "profile": {
    "developer": "0x...",
    "agentName": "risk-agent",
    "tokenId": "1",
    "totalBond": "1000",
    "blacklisted": false,
    "createdAt": 1710000000,
    "lastAuditAt": 1710000100,
    "auditCount": 3
  },
  "auditReport": {
    "auditId": 7,
    "timestamp": 1710000100,
    "auditScore": 95,
    "status": 2,
    "reportCID": "bafy-report-7",
    "manifestUrl": "https://example.com/manifest.json",
    "appealRequested": false,
    "appealApproved": false
  }
}
```

若指定的 `auditId` 不存在：

```json
{
  "status": "audit_not_found",
  "tokenId": "1",
  "auditId": 7,
  "profile": { "...": "..." }
}
```

若 token 不存在：

```json
{
  "status": "not_found",
  "tokenId": "1"
}
```

### 3. 浏览历史审计记录

```bash
npm run run:agent:registry -- history --token-id 1 --offset 0 --limit 2
```

返回一行 JSON，按"最新优先"返回分页结果：

```json
{
  "status": "ok",
  "tokenId": "1",
  "profile": {
    "developer": "0x...",
    "agentName": "risk-agent",
    "tokenId": "1",
    "totalBond": "1000",
    "blacklisted": false,
    "createdAt": 1710000000,
    "lastAuditAt": 1710000100,
    "auditCount": 4
  },
  "paging": {
    "offset": 0,
    "limit": 2,
    "total": 4,
    "returned": 2,
    "hasMore": true
  },
  "audits": [
    {
      "index": 3,
      "auditId": 12,
      "timestamp": 1710000100,
      "auditScore": 95,
      "status": 2,
      "reportCID": "bafy-report-12",
      "manifestUrl": "https://example.com/manifest.json",
      "appealRequested": false,
      "appealApproved": false
    },
    {
      "index": 2,
      "auditId": 11,
      "timestamp": 1710000000,
      "auditScore": 90,
      "status": 2,
      "reportCID": "bafy-report-11",
      "manifestUrl": "https://example.com/manifest.json",
      "appealRequested": false,
      "appealApproved": false
    }
  ]
}
```

若 token 不存在：

```json
{
  "status": "not_found",
  "tokenId": "1"
}
```

### 4. 验证可信材料

统一入口：

```bash
npm run run:agent:verify -- report --event-key 0xabc:0
npm run run:agent:verify -- evidence --event-key 0xabc:0
npm run run:agent:verify -- attestation --event-key 0xabc:0
```

说明：

- `report` 转发到 `run:report:verify`
- `evidence` 转发到 `run:evidence:verify`
- `attestation` 转发到 `run:attestation:verify`
- 所有参数继续透传，可附加 `--state-dir`

## SOP

### 场景 A：帮用户找一个可信 agent

1. 根据用户条件调用 `search`
2. 先筛掉：
   - `blacklisted === true`
   - `latestStatus` 不符合要求
   - `latestScore` 低于用户门槛
3. 取前几个候选，再逐个调用 `get-report`
4. 输出推荐时同时说明：
   - 当前分数 / 状态
   - 最近一次审计时间
   - 是否有 appeal
   - 是否还需要进一步 `verify`

### 场景 B：帮用户判断某个 agent 靠不靠谱

1. 已知 tokenId 时，先调用 `get-report`
2. 若用户只关心最近状态，直接读取 latest 结果
3. 若用户指定某次审计，使用 `--audit-id`
4. 若用户想看整体变化趋势，改用 `history`
5. 重点解释：
   - `blacklisted`
   - `auditCount`
   - `latestAuditReport.auditScore` 或 `auditReport.auditScore`
   - `latestAuditReport.status` 或 `auditReport.status`
   - `appealRequested` / `appealApproved`
6. 如果用户需要更强证明，再补 `verify`

### 场景 C：帮用户回看历史审计

1. 已知 tokenId 时调用 `history`
2. 默认按最新优先解释最近几次审计
3. 如需继续翻页，从 `offset + returned` 继续请求
4. 重点说明：
   - 分页区间
   - 是否还有更多历史记录（`hasMore`）
   - 分数 / 状态是否出现连续下降或异常波动
   - 是否存在 appeal
5. 如果用户锁定某次审计，再改用 `get-report --audit-id <auditId>` 读取单条详情

### 场景 D：帮用户验证一份报告/证明

1. 先明确用户要验的是 `report`、`evidence` 还是 `attestation`
2. 调用统一 `verify` 入口
3. 按结果解释：
   - `verified`：可认为该层数据完整且未被篡改
   - `not_found`：本地 state 中未找到对应材料
   - `conflict`：同一 eventKey 存在多个候选文件
   - `hash_mismatch`：内容与文件名嵌入哈希不一致
   - `invalid_event_key`：输入格式错误
4. 若是 `attestation` `verified` 且启用了 report-data binding，可进一步说明其与 `eventKey + manifestHash + evidenceRoot` 的绑定关系

## Error handling

所有 CLI 命令都返回单行 JSON。AI 助手应优先按 `status` 字段处理；遇到下列情况按以下 SOP 执行：

### E1. 链上 RPC 超时 / 网络错误

症状：CLI 进程以非零退出码结束，stderr 出现 `JSON-RPC request failed`、`ETIMEDOUT`、`ECONNREFUSED` 或 `fetch failed`。

SOP：

1. 检查 `RPC_URL` / `LISTENER_RPC_URL` 环境变量是否配置正确
2. 同一命令最多重试 2 次，重试之间退避 2 秒
3. 仍失败则向用户报告："链上 RPC 当前不可达，无法读取该 agent 的最新状态，建议稍后重试"，**不要**用旧缓存伪造结论
4. 如果业务允许降级，可改为只展示历史已读到的字段（标注"该字段为缓存值，未与链上同步"）

### E2. Agent 被惩罚 / 黑名单（Slashed）

症状：`get-report` / `search` 返回 `profile.blacklisted === true`，或 `latestAuditReport.status` 在合约定义中代表惩罚态（典型为非 `2`，例如 `4=slashed`、`5=blacklisted`）。

SOP：

1. 在场景 A（推荐 agent）中**直接将其从候选列表剔除**，不向用户呈现
2. 在场景 B（评判某个 agent）中**必须显式告知**："该 agent 已被链上仲裁惩罚 / 列入黑名单，不建议接入"
3. 进一步用 `history` 检查近 N 次审计的分数与状态趋势，向用户解释惩罚是否一次性偶发还是持续异常
4. 若用户仍坚持要用，提示其先调用 `verify` 链路确认最新一份非惩罚态报告的真伪

### E3. token 不存在 / 审计不存在

症状：`status === "not_found"` 或 `status === "audit_not_found"`。

SOP：

1. 直接告诉用户输入的 tokenId 或 auditId 在链上不存在
2. 不要试图猜测临近 id；让用户重新提供或先用 `search` 找候选

### E4. 可信材料校验失败

症状：`verify` 子命令返回 `hash_mismatch` / `conflict` / `invalid_event_key`。

SOP：

- `hash_mismatch`：明确告诉用户文件内容与文件名嵌入哈希不一致，**视为不可信**，不要继续基于该文件做结论
- `conflict`：同一 eventKey 下存在多个候选材料，应让用户指定 `--state-dir` 或清理 listener state
- `invalid_event_key`：参数格式错误，按 `<txHash>:<logIndex>` 重新输入

## Response guidance for AI assistants

- 优先引用 CLI 的结构化 JSON，不要凭空推断链上状态。
- 当 `latestAuditReport` 为 `null` 时，明确说"找到 agent，但还没有最新审计记录"。
- 当 `get-report --audit-id` 返回 `audit_not_found` 时，明确说"agent 存在，但指定 auditId 不存在"。
- 当 `history.paging.hasMore === true` 时，可以建议继续增加 `offset` 翻页。
- `history.audits` 中的 `index` 是链上历史索引，顺序按最新优先返回，不等于 `auditId`。
- 当 `search.hasMore === true` 时，可以建议继续从 `nextScanTokenId` 翻页扫描。
- 不要把 `verify` 成功解读为"这个 agent 一定安全"，它只证明材料的完整性 / 一致性，不替代风险判断。

## Current priority

按照当前实现，Skill 需要同时覆盖三类查询：

- `search`：发现候选 agent
- `get-report`：读取最新或指定历史审计摘要
- `history`：分页回看历史审计轨迹

因此，后续优先维护 CLI 字段契约与本文件说明的一致性，再继续扩展更复杂的可信评分或外部集成能力。
