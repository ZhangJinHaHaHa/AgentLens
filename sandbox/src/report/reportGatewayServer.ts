import { createServer, type Server } from "node:http";

import CID from "cids";

import type { ReportGatewayConfig } from "./readReportGatewayConfig";

interface ReportGatewayRequestLike extends AsyncIterable<Buffer | string> {
  method?: string;
  url?: string;
}

interface ReportGatewayResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

/**
 * 构造函数只把配置与网络实现捕获到请求闭包中，不负责 `listen`、关闭或连接生命周期；
 * 这些状态仍由 CLI/宿主持有的 Node `Server` 管理。处理器没有跨请求可变缓存，
 * 因而同一 CID 的并发请求彼此独立，也不会在本进程内形成陈旧副本。
 */
export function createReportGatewayServer(
  config: ReportGatewayConfig,
  fetchImpl: typeof fetch = fetch
): Server {
  return createServer((request, response) =>
    void handleReportGatewayRequest(request, response, config, fetchImpl)
  );
}

/**
 * 报告网关是公开只读的 HTTP 边界：入站请求不使用上游 Bearer 令牌做客户端认证，
 * 该令牌仅随服务器到受信任上游的请求发送。路由仅接受健康检查、预检和单个 CID 查询；
 * 所有可预期分支都会结束响应，且不会读取或持久化请求体。
 */
export async function handleReportGatewayRequest(
  request: ReportGatewayRequestLike,
  response: ReportGatewayResponseLike,
  config: ReportGatewayConfig,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end("");
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    writeJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && request.url?.startsWith("/reports/")) {
    // URL 片段先还原再做 CID 解析；只有库认可的 CIDv0/CIDv1 才能进入上游 URL 构造。
    const reportCID = decodeURIComponent(request.url.slice("/reports/".length));
    if (!isValidCid(reportCID)) {
      writeJson(response, 400, {
        error: "reportCID must be a valid IPFS CID."
      });
      return;
    }

    const sourceUrl = `${config.upstreamBaseUrl}${encodeURIComponent(reportCID)}`;

    let upstreamResponse: Response;
    try {
      // 每个入站请求只对应一次有超时上限的上游读取；本层不重试，避免故障时放大网关流量。
      upstreamResponse = await fetchImpl(sourceUrl, {
        headers: config.authToken
          ? {
              Authorization: `Bearer ${config.authToken}`
            }
          : undefined,
        signal: AbortSignal.timeout(config.fetchTimeoutMs)
      });
    } catch {
      // 网络异常、超时等统一映射为 502，既保留“上游失败”语义，也不向客户端泄露底层异常细节。
      writeJson(response, 502, {
        error: "Failed to fetch the detailed audit report from the upstream gateway.",
        sourceUrl
      });
      return;
    }

    if (upstreamResponse.status === 404) {
      writeJson(response, 404, {
        error: "Detailed audit report was not found in the upstream gateway.",
        sourceUrl
      });
      return;
    }

    if (!upstreamResponse.ok) {
      // 除明确的缺失外，上游 4xx/5xx 都视为代理依赖失败，避免客户端误认为是本地路由状态。
      writeJson(response, 502, {
        error: `Upstream gateway responded with status ${upstreamResponse.status}.`,
        sourceUrl
      });
      return;
    }

    response.statusCode = 200;
    // 成功体按上游内容类型原样转发；这里不解析 JSON，也不验证响应字节是否与 CID 匹配。
    // 因而 CID 语法校验只约束寻址输入，内容真实性仍属于所配置上游与调用方的信任边界。
    response.setHeader(
      "Content-Type",
      upstreamResponse.headers.get("content-type") || "application/json"
    );
    response.end(await upstreamResponse.text());
    return;
  }

  writeJson(response, 404, { error: "not found" });
}

// 使用 `cids` 库而非前缀判断，以维持 CIDv0 与不同 multibase CIDv1 的兼容范围。
function isValidCid(value: string): boolean {
  if (value.trim() === "") {
    return false;
  }

  try {
    new CID(value);
    return true;
  } catch {
    return false;
  }
}

// 统一 JSON 错误出口，确保状态码和媒体类型在所有本地生成的响应上同步设置。
function writeJson(
  response: ReportGatewayResponseLike,
  statusCode: number,
  body: unknown
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

/**
 * 该服务有意提供跨域只读访问：允许来源为 `*`，但方法集合限制为 GET/OPTIONS。
 * Authorization 出现在允许头列表仅为浏览器预检兼容，不代表网关会读取或验证入站凭据。
 */
function setCorsHeaders(response: ReportGatewayResponseLike): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}
