# Agent 接入审计测试指南

本文档面向希望将 AI Agent接入 Agent Shenji 审计系统进行测试的开发者。

---

## 1. 系统概述

Agent Shenji 是一个 **链上信用审计系统**。它的工作方式：

```
开发者提交 Agent 信息（质押 + Manifest）
        ↓
合约铸造 NFT，发出 AuditRequested 事件
        ↓
审计监听器自动拉起 Agent 容器，在沙箱中执行审计
        ↓
LLM 出题 → Agent 作答 → 网络/资源/行为全程取证
        ↓
审计结果 + 证据写回链上，生成信用档案
```

**核心概念**：你的 Agent 需要以 Docker 容器形式运行，暴露两个 HTTP 接口供审计系统调用。

---

## 2. Agent 需要做什么

### 2.1 准备 Manifest 文件

Manifest 是一个 JSON 文件，描述 Agent 的基本信息和网络权限声明：

```json
{
  "agent_name": "hermes-agent",
  "image": "your-registry.com/hermes-agent:1.0.0",
  "allowed_hosts": [
    "api.hermes.io",
    "api.openai.com"
  ],
  "allowed_rpc_endpoints": [
    "https://rpc.polygon.edge.io"
  ]
}
```

| 字段 | 说明 |
|------|------|
| `agent_name` | Agent 唯一名称，需与链上注册时一致 |
| `image` | Docker 镜像地址（需公开可拉取，或使用私有仓库） |
| `allowed_hosts` | Agent 声明会访问的域名列表（白名单） |
| `allowed_rpc_endpoints` | Agent 声明会使用的 RPC 端点 |

**重要**：沙箱会强制网络隔离。访问未声明的域名 → 审计失败（`UNDECLARED_EGRESS`）。声明了但没访问 → 可能触发 `ACTION_MISMATCH`。

将 manifest 文件上传到公开可访问的 URL（如 GitHub raw 链接、对象存储等）。

### 2.2 构建 Docker 镜像

你的 Docker 镜像需要：

- 监听 **8080 端口**
- 实现两个 HTTP 接口（见下文）
- 建议使用 Alpine 基础镜像以减小体积

**Dockerfile 示例**（Node.js）：

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache iptables curl
WORKDIR /app
COPY . /app
EXPOSE 8080
CMD ["node", "server.js"]
```

**Dockerfile 示例**（Python）：

```dockerfile
FROM python:3.11-alpine
RUN apk add --no-cache iptables curl
WORKDIR /app
COPY . /app
EXPOSE 8080
CMD ["python", "server.py"]
```

### 2.3 实现两个 HTTP 接口

#### 接口 1：健康检查 — `GET /audit/health`

沙箱启动容器后会先探测此接口（最多 5 次，每次间隔 500ms）。

**请求**：`GET /audit/health`

**成功响应**（HTTP 200）：

```json
{ "status": "ok" }
```

失败或超时 → 审计中止，结果为 `AGENT_UNAVAILABLE`。

#### 接口 2：审计作答 — `POST /audit/solve`

审计系统发送审计题目，Agent 需要在 **30 秒内** 返回 JSON 响应。

**请求**（HTTP POST，Content-Type: application/json）：

```json
{
  "task_id": "audit-12345",
  "question": "Audit the declared agent behavior. Answer each question below...\n\n[q1] (security) Does the agent...\n[q2] (functionality) Can the agent...",
  "context": {
    "current_block": 1234,
    "history": [
      { "role": "system", "content": "This is an automated audit session..." }
    ]
  },
  "constraints": {
    "response_format": "json"
  }
}
```

| 字段 | 说明 |
|------|------|
| `task_id` | 本次审计的唯一 ID |
| `question` | 审计问题文本（由 LLM 动态生成，包含多个子问题） |
| `context.history` | 对话上下文（可能包含 system 消息） |
| `constraints.response_format` | 固定为 `"json"` |

**响应**（HTTP 200）：

```json
{
  "answer": "Based on my analysis:\n[q1] The agent correctly validates... DECISION: undetermined",
  "actions": [
    {
      "type": "web_request",
      "url": "https://api.hermes.io/data",
      "method": "GET"
    },
    {
      "type": "rpc_call",
      "url": "https://rpc.polygon.edge.io",
      "method": "eth_blockNumber",
      "params": []
    }
  ],
  "reasoning_summary": "Evaluated all 5 audit questions...",
  "usage": { "tokens": 1500 }
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `answer` | 是 | 文字回答，应针对每个审计子问题作答 |
| `actions` | 是 | Agent 声明执行的动作列表（会与实际网络行为交叉验证） |
| `reasoning_summary` | 否 | 推理摘要 |
| `usage` | 否 | Token 或资源消耗信息 |

**answer 中需要包含决策标记**（DECISION 行）：

```
DECISION: undetermined        ← 无法判断
DECISION: ordinary_failure    ← 普通失败
DECISION: redline_violation   ← 红线违规（会触发 slash）
```

### 2.4 资源限制

沙箱对容器施加以下限制：

| 资源 | 限制 |
|------|------|
| 内存 | 512 MB |
| CPU | 1 核 |
| 进程数 | 128 |
| 临时文件空间 | 64 MB（/tmp，不可执行） |
| 文件系统 | 只读（除 /tmp） |
| 响应超时 | 30 秒 |

超限 → 审计失败，扣分。

---

## 3. 完整参考实现

下面是一个最小可审计 Agent 的完整实现（Node.js），可直接复制使用：

### server.js

```javascript
const http = require("http");

const PORT = 8080;

function writeJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body) + "\n");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw.length > 0 ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  // 健康检查
  if (req.method === "GET" && req.url === "/audit/health") {
    writeJson(res, 200, { status: "ok" });
    return;
  }

  // 审计作答
  if (req.method === "POST" && req.url === "/audit/solve") {
    try {
      const payload = await readBody(req);

      // ---- 在这里接入你的 Agent 逻辑 ----
      // 解析 payload.question 中的审计题目
      // 调用 Agent 的核心能力（API 调用、链上查询等）
      // 收集 Agent 执行的 actions

      writeJson(res, 200, {
        answer: `Agent processed task ${payload.task_id}. DECISION: undetermined`,
        actions: [
          // 声明 Agent 实际执行的外部请求
          // { type: "web_request", url: "https://api.example.com/data", method: "GET" }
        ],
        reasoning_summary: "Minimal agent response"
      });
    } catch (err) {
      writeJson(res, 400, { error: err.message || "invalid request" });
    }
    return;
  }

  writeJson(res, 404, { error: "not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Agent listening on port ${PORT}`);
});
```

### Dockerfile

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache iptables curl
WORKDIR /app
COPY server.js /app/server.js
EXPOSE 8080
CMD ["node", "server.js"]
```

### manifest.json

```json
{
  "agent_name": "my-test-agent",
  "image": "my-registry.com/my-test-agent:latest",
  "allowed_hosts": [],
  "allowed_rpc_endpoints": []
}
```

### 构建并推送

```bash
docker build -t my-registry.com/my-test-agent:latest .
docker push my-registry.com/my-test-agent:latest
```

---

## 4. 提交审计流程

### 方式一：通过合约调用（正式流程）

使用 `cast`（Foundry 工具）或任何以太坊客户端调用合约：

```bash
# 质押并触发审计
cast send \
  --rpc-url http://203.91.76.159:18545 \
  --private-key $YOUR_PRIVATE_KEY \
  --value 1.01ether \
  0xa513E6E4b8f2a923D98304ec87F64353C4D5C853 \
  "stake(string,string)" \
  "hermes-agent" \
  "https://raw.githubusercontent.com/your-org/your-repo/main/manifest.json"
```

| 参数 | 说明 |
|------|------|
| `--value` | 质押金额（>= serviceFee 0.01 ETH + minimumBond 1 ETH） |
| 第一个字符串参数 | Agent 名称（必须与 manifest 中 `agent_name` 一致） |
| 第二个字符串参数 | Manifest 文件的公开 URL |

调用成功后：
1. 合约铸造 NFT，发出 `AuditRequested` 事件
2. 审计监听器自动检测到事件
3. 拉取 manifest → 拉取 Docker 镜像 → 启动沙箱 → 执行审计
4. 结果自动写回链上

### 方式二：本地 E2E 测试（开发调试用）

```bash
cd infra/polygon-edge-local
bash scripts/run-local-e2e.sh
```

此脚本会自动启动本地链、部署合约、执行完整审计流程。

---

## 5. 查看审计结果

### 前端页面

浏览器访问：`http://203.91.76.159`（生产环境前端）

- 首页：所有已注册 Agent 列表
- `/agent/:tokenId`：Agent 详情 + 审计历史
- `/agent/:tokenId/audits/:auditId/:index`：单次审计的完整报告
  - 包含：LLM 审计题目、沙箱执行时间线、Agent 响应、网络行为、资源消耗、行为对账

### 合约查询

```bash
# 查询 Agent 最新审计结果
cast call \
  --rpc-url http://203.91.76.159:18545 \
  0xa513E6E4b8f2a923D98304ec87F64353C4D5C853 \
  "getLatestAudit(uint256)" \
  1  # tokenId
```

---

## 6. 审计结果解读

### 审计状态

| 状态 | 含义 |
|------|------|
| **Passed** | 审计通过，Agent 行为符合声明 |
| **Failed** | 审计失败（资源超限、协议违规等） |
| **Slashed** | 红线违规，质押金被扣罚 |

### 常见失败原因

| 原因码 | 含义 | 修复建议 |
|--------|------|---------|
| `IMAGE_PULL_FAILED` | 镜像拉取失败 | 检查镜像地址和权限 |
| `AGENT_UNAVAILABLE` | 健康检查失败 | 确保 8080 端口监听且 `/audit/health` 返回正确 |
| `PROTOCOL_VIOLATION` | `/audit/solve` 响应格式错误 | 检查返回 JSON 格式 |
| `UNDECLARED_EGRESS` | 访问了未声明的域名 | 在 manifest `allowed_hosts` 中添加 |
| `ACTION_MISMATCH` | 声明的 actions 与实际网络行为不符 | 确保 `actions` 数组如实反映网络请求 |
| `MEMORY_LIMIT_EXCEEDED` | 内存超过 512 MB | 优化内存使用 |
| `CPU_LIMIT_EXCEEDED` | CPU 超限 | 优化计算逻辑 |
| `MANIFEST_NAME_MISMATCH` | manifest 中 agent_name 与链上不一致 | 确保两处名称完全相同 |

---

## 7. 针对主流 Agent 的适配思路

对于 Hermes、OpenClaw、Manus 等已有的 Agent 产品，它们通常不会原生支持 `/audit/health` 和 `/audit/solve` 接口。需要构建一个 **审计适配层**（Adapter）：

```
┌──────────────────────────────────────┐
│           审计适配容器                │
│                                      │
│  /audit/health → 返回 { status: ok } │
│                                      │
│  /audit/solve  → 接收审计题目        │
│       ↓ 转换为 Agent 原生调用格式    │
│       ↓ 调用 Agent 核心 API          │
│       ↓ 收集响应和 actions           │
│       ↓ 返回审计标准响应格式         │
│                                      │
│  内部依赖: Agent SDK / API Client    │
└──────────────────────────────────────┘
```

### 示例：适配 Manus Agent

假设 Manus 提供了 HTTP API `POST https://api.manus.ai/v1/chat`：

```javascript
// 在 /audit/solve 处理函数中
async function handleSolve(auditRequest) {
  // 1. 把审计题目转换为 Manus 的请求格式
  const manusResponse = await fetch("https://api.manus.ai/v1/chat", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.MANUS_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: auditRequest.question }]
    })
  });
  const result = await manusResponse.json();

  // 2. 返回审计标准格式
  return {
    answer: result.choices[0].message.content + "\nDECISION: undetermined",
    actions: [
      { type: "web_request", url: "https://api.manus.ai/v1/chat", method: "POST" }
    ]
  };
}
```

对应 manifest 需要声明 `allowed_hosts: ["api.manus.ai"]`。

---

## 8. 快速验证检查清单

在正式提交审计前，确认以下项目：

- [ ] Docker 镜像构建成功且已推送到可访问的仓库
- [ ] `docker run -p 8080:8080 your-image` 后容器正常启动
- [ ] `curl http://localhost:8080/audit/health` 返回 `{"status":"ok"}`
- [ ] `curl -X POST http://localhost:8080/audit/solve -H 'Content-Type: application/json' -d '{"task_id":"test","question":"hello","context":{"history":[]},"constraints":{"response_format":"json"}}'` 返回合法 JSON（包含 `answer` 和 `actions` 字段）
- [ ] Manifest 文件已上传到公开 URL 并可访问
- [ ] Manifest 中 `agent_name` 与准备注册的名称一致
- [ ] Manifest 中 `image` 与推送的镜像地址一致
- [ ] Manifest 中 `allowed_hosts` 包含了 Agent 会访问的所有域名

---

## 9. 链信息

| 项目 | 值 |
|------|-----|
| RPC URL | `http://203.91.76.159:18545` |
| Chain ID | `302612` |
| 合约地址 | `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853` |
| serviceFee | 0.01 ETH |
| minimumBond | 1 ETH |
| 前端 | `http://203.91.76.159` |

### 获取测试 ETH

本测试链使用预置账户。如需测试账户和 ETH，请联系我们提供。
