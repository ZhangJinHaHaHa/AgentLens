/**
 * 该可执行文件启动最小测试 Agent HTTP 服务，暴露约定健康/求解路由，并在启动时依据环境选择静态或 LLM 模式；不提供生产级认证、TLS、限流或请求体上限。
 * 监听在 0.0.0.0，所有请求体与 LLM 环境配置都跨越网络/进程信任边界；JSON 解析失败返回 400，未知路由返回 404，成功响应保持换行结尾。
 * server 是模块级长生命周期状态并可并发处理请求，useLlm 在进程启动时固定，运行中修改环境不会切换模式；LLM 模式会产生外部网络调用。
 * 本服务专用于隔离审计演示，部署方必须把它限制在测试容器网络；启动日志只标识 provider 模式，不应输出 API key 或请求内容。
 */
import { createServer } from "node:http";

import { PORT } from "../config/constants";
import { buildHealthResponse, buildSolveResponse } from "./response";
import { buildLlmSolveResponse } from "./llmAgent";
import type { AuditSolveRequest } from "../types/manifest";

const useLlm = Boolean(process.env.AGENT_LLM_PROVIDER && process.env.AGENT_LLM_API_KEY);

function writeJson(response: import("node:http").ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(`${JSON.stringify(body)}\n`);
}

async function readJsonBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody.length > 0 ? JSON.parse(rawBody) : {};
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/audit/health") {
    writeJson(response, 200, buildHealthResponse());
    return;
  }

  if (request.method === "POST" && request.url === "/audit/solve") {
    try {
      const payload = (await readJsonBody(request)) as AuditSolveRequest;

      if (useLlm) {
        const result = await buildLlmSolveResponse(payload);
        writeJson(response, 200, result);
      } else {
        writeJson(response, 200, buildSolveResponse(payload));
      }
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : "invalid request"
      });
    }

    return;
  }

  writeJson(response, 404, { error: "not found" });
});

const providerLabel = useLlm ? `LLM mode (${process.env.AGENT_LLM_PROVIDER})` : "static mode";
server.listen(PORT, "0.0.0.0", () => {
  process.stdout.write(`test-agent listening on ${PORT} [${providerLabel}]\n`);
});
