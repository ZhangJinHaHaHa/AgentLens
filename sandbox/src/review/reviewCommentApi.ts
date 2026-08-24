import type { IncomingMessage, ServerResponse } from "node:http";
import type { ReviewCommentStore } from "./reviewCommentStore";
import { computeCommentHash } from "./reviewCommentStore";

export interface ReviewCommentApiDependencies {
  // store 由启动层注入并拥有；API 只编排请求，不管理文件生命周期或跨进程并发。
  store: ReviewCommentStore;
}

function readBody(req: IncomingMessage): Promise<string> {
  // 当前实现把请求体完整缓存在内存且不设大小/超时上限，生产入口必须在反向代理或上层服务器实施配额。
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function handleReviewCommentRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ReviewCommentApiDependencies
): void {
  // URL、方法、正文和 reviewer 都来自网络信任边界；此处理器只做路由与最小类型校验，不承担认证授权。
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const match = url.pathname.match(/^\/api\/reviews\/(\d+)\/comments$/);

  if (!match) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const tokenId = match[1];

  if (req.method === "GET") {
    // 每次读取都由 store 从其持久化快照解析，API 不缓存结果，因此状态所有权仍在存储层。
    const comments = deps.store.getCommentsByTokenId(tokenId);
    sendJson(res, 200, { comments });
    return;
  }

  if (req.method === "POST") {
    // Node HTTP 回调合同为 void；异步流程在内部闭合并捕获错误，调用者不能通过返回值等待提交完成。
    void (async () => {
      try {
        const rawBody = await readBody(req);
        const body = JSON.parse(rawBody) as Record<string, unknown>;

        const { reviewId, reviewer, commentText, commentHash } = body;

        // 这里只确认必填字段类型；身份真实性、长度限制、内容策略与 reviewId/tokenId 归属必须由可信上游保证。
        if (typeof reviewId !== "string" || typeof reviewer !== "string" || typeof commentText !== "string") {
          sendJson(res, 400, { error: "Missing required fields: reviewId, reviewer, commentText" });
          return;
        }

        // 兼容旧客户端不传 commentHash；传入时只接受正文 SHA-256 的小写 hex（可带小写 0x），存储层仍会自行重算。
        // Verify commentHash if provided
        if (typeof commentHash === "string" && commentHash.length > 0) {
          const computed = computeCommentHash(commentText);
          if (computed !== commentHash.replace(/^0x/, "")) {
            sendJson(res, 400, { error: "Comment hash does not match text" });
            return;
          }
        }

        const saved = deps.store.saveComment({
          reviewId,
          tokenId,
          reviewer,
          commentText
        });

        // saveComment 没有幂等键；客户端在响应丢失后重试 POST 会新增重复评论，调用方需按业务 ID 自行抑制重放。
        sendJson(res, 201, { comment: saved });
      } catch (error) {
        // JSON 解析、请求流和同步存储错误统一为 500；消息会直接返回，部署时不得让底层错误携带密钥或敏感路径。
        const msg = error instanceof Error ? error.message : String(error);
        sendJson(res, 500, { error: msg });
      }
    })();
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}
