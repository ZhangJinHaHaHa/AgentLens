import type { IncomingMessage, ServerResponse } from "node:http";
import type { ReviewCommentStore } from "./reviewCommentStore";
import { computeCommentHash } from "./reviewCommentStore";

export interface ReviewCommentApiDependencies {
  store: ReviewCommentStore;
}

function readBody(req: IncomingMessage): Promise<string> {
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
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const match = url.pathname.match(/^\/api\/reviews\/(\d+)\/comments$/);

  if (!match) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const tokenId = match[1];

  if (req.method === "GET") {
    const comments = deps.store.getCommentsByTokenId(tokenId);
    sendJson(res, 200, { comments });
    return;
  }

  if (req.method === "POST") {
    void (async () => {
      try {
        const rawBody = await readBody(req);
        const body = JSON.parse(rawBody) as Record<string, unknown>;

        const { reviewId, reviewer, commentText, commentHash } = body;

        if (typeof reviewId !== "string" || typeof reviewer !== "string" || typeof commentText !== "string") {
          sendJson(res, 400, { error: "Missing required fields: reviewId, reviewer, commentText" });
          return;
        }

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

        sendJson(res, 201, { comment: saved });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        sendJson(res, 500, { error: msg });
      }
    })();
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}
