import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import type {
  AppealCreateInput,
  AppealReviewInput,
  AppealTicket
} from "./persistentAppealStore";
import type { AppealCompensationExecutor } from "./appealCompensation";
import type { AppealChainWriter } from "./appealChainWriter";

/**
 * intake 层只编排 HTTP、补偿与链写入；申诉集合、最新记录顺序及审核结果的持久化所有权均在 store。
 * 该窄接口也意味着本层没有事务、锁或幂等键可用，相关保证不能由路由处理器隐式推断。
 */
export interface AppealStore {
  createAppeal(input: AppealCreateInput): Promise<AppealTicket>;
  findLatestAppeal(tokenId: string, auditId: string): Promise<AppealTicket | undefined>;
  findAppealById(appealId: string): Promise<AppealTicket | undefined>;
  reviewAppeal(appealId: string, input: AppealReviewInput): Promise<AppealTicket>;
}

export interface AppealIntakeServerOptions {
  store: AppealStore;
  compensateAppeal?: AppealCompensationExecutor;
  // adminToken 仅保护下方 PATCH 审核路由；POST 提交和 GET 查询是否可公开应由部署网络边界另行决定。
  adminToken?: string;
  appealChainWriter?: AppealChainWriter;
}

interface AppealRequestLike extends AsyncIterable<Buffer | string> {
  method?: string;
  url?: string;
  headers?: { authorization?: string | string[]; [key: string]: string | string[] | undefined };
}

interface AppealResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

export function createAppealIntakeServer(
  options: AppealIntakeServerOptions
): Server {
  // Node 回调不等待 Promise；各已识别路由必须在 handleAppealIntakeRequest 内完成错误到 HTTP 响应的收敛。
  return createServer((request, response) =>
    void handleAppealIntakeRequest(request, response, options.store, options.compensateAppeal, options.adminToken, options.appealChainWriter)
  );
}

export async function handleAppealIntakeRequest(
  request: AppealRequestLike,
  response: AppealResponseLike,
  store: AppealStore,
  compensateAppeal?: AppealCompensationExecutor,
  adminToken?: string,
  appealChainWriter?: AppealChainWriter
): Promise<void> {
  if (request.method === "PATCH" && request.url?.startsWith("/api/appeals/") && request.url.endsWith("/review")) {
    // 审核会触发终态持久化及可选资金补偿，因此未配置凭据时采取拒绝服务的安全默认值。
    if (!adminToken) {
      writeJson(response, 403, { error: "Appeal review authorization is not configured." });
      return;
    }

    const rawAuth = request.headers?.authorization;
    const authHeader = Array.isArray(rawAuth) ? rawAuth[0] ?? "" : rawAuth ?? "";
    // 此处执行完整 Bearer 字符串匹配，不接受查询参数、Cookie 或多个候选令牌，避免鉴权来源产生歧义。
    if (authHeader !== `Bearer ${adminToken}`) {
      writeJson(response, 401, { error: "Unauthorized" });
      return;
    }

    try {
      // URL 与 JSON 均是不可信输入；先完成解码和字段规范化，再读取或改变任何申诉状态。
      const appealId = parseReviewAppealId(request.url);
      const payload = parseAppealReviewPayload(await readJsonBody(request));
      const currentAppeal = await store.findAppealById(appealId);
      if (!currentAppeal) {
        throw new Error("Appeal not found.");
      }

      let compensationTxHash = payload.review.compensationTxHash;
      if (payload.compensation) {
        if (!compensateAppeal) {
          throw new Error("appeal compensation is not configured.");
        }

        // 补偿先于本地审核写入发生。链上成功而 store 更新失败时会留下跨介质不一致，且直接重试可能再次补偿；
        // 当前实现没有 outbox/幂等键，恢复流程必须先用申诉标识核对链上交易，再决定是否重放本请求。
        const compensation = await compensateAppeal({
          tokenId: currentAppeal.tokenId,
          auditId: currentAppeal.auditId,
          amount: payload.compensation.amount,
          reasonCode: payload.compensation.reasonCode
        });
        compensationTxHash = compensation.transactionHash;
      }

      // store 是审核终态的唯一持久化所有者；本层不做 compare-and-set，竞争审核与合法状态迁移由具体 store 契约决定。
      const updated = await store.reviewAppeal(appealId, {
        ...payload.review,
        ...(compensationTxHash ? { compensationTxHash } : {})
      });
      writeJson(response, 200, {
        appealId: updated.appealId,
        status: updated.status,
        ...(updated.compensationTxHash ? { compensationTxHash: updated.compensationTxHash } : {})
      });
    } catch (error) {
      // 404 依赖 store 的稳定错误文案；其余解析、补偿和持久化异常均映射为 400，并会把 Error.message 暴露给客户端。
      const message = error instanceof Error ? error.message : "Invalid appeal review request.";
      writeJson(response, message === "Appeal not found." ? 404 : 400, {
        error: message
      });
    }

    return;
  }

  if (request.method === "GET" && request.url?.startsWith("/api/appeals?")) {
    try {
      const { tokenId, auditId } = parseAppealLookupUrl(request.url);
      // “latest”的顺序语义由 store 定义；当前处理器不按时间戳重排，也不缓存查询结果。
      const ticket = await store.findLatestAppeal(tokenId, auditId);

      if (!ticket) {
        writeJson(response, 404, { error: "Appeal not found." });
        return;
      }

      writeJson(response, 200, {
        appealId: ticket.appealId,
        status: ticket.status,
        createdAt: ticket.createdAt
      });
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : "Invalid appeal lookup request."
      });
    }

    return;
  }

  if (request.method === "POST" && request.url === "/api/appeals") {
    try {
      // 先通过传输边界规范化输入，再让 store 生成 appealId 并完成本地持久化；持久化失败不会尝试链写入。
      const payload = parseAppealPayload(await readJsonBody(request));
      const created = await store.createAppeal(payload);

      // 本地记录是接收请求的主状态：链同步为尽力而为，失败只记录日志，不回滚已创建的申诉。
      // 这里没有持久化待重试任务，因此 202 不能被解释为链上已经存在对应记录。
      // Write appeal to chain (V2) — non-fatal
      if (appealChainWriter) {
        try {
          await appealChainWriter.fileAppealOnChain({
            tokenId: payload.tokenId,
            auditId: payload.auditId,
            // 缺少报告摘要时使用全零 bytes32 维持 V2 ABI 兼容；该哨兵值明确不构成证据完整性证明。
            evidenceHash: created.reportHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
            // 当前部署把内部 appealId 放入 string 参数；它未必是可从内容网络解析的 CID，消费者必须按此兼容语义读取。
            appealCID: created.appealId
          });
        } catch (chainErr) {
          console.error("[appealIntakeServer] fileAppealOnChain failed:", chainErr);
        }
      }

      writeJson(response, 202, {
        appealId: created.appealId,
        status: created.status
      });
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : "Invalid appeal request."
      });
    }

    return;
  }

  writeJson(response, 404, { error: "not found" });
}

function parseReviewAppealId(url: string): string {
  const match = /^\/api\/appeals\/([^/]+)\/review$/.exec(url);
  if (!match || match[1].trim().length === 0) {
    throw new Error("appealId is required.");
  }

  // 百分号解码可能抛出 URIError，并由路由统一转成 400；解码结果仍需由 store 视其标识/路径模型继续约束。
  return decodeURIComponent(match[1]);
}

async function readJsonBody(request: AppealRequestLike): Promise<unknown> {
  // 当前实现会把整个流聚合到内存，且不校验 Content-Type 或字节上限；生产入口必须在反向代理/上游限制请求体和速率。
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (rawBody.length === 0) {
    return {};
  }

  return JSON.parse(rawBody);
}

function writeJson(response: AppealResponseLike, statusCode: number, body: unknown): void {
  // 所有响应统一为带换行的 JSON；客户端不应依赖对象属性之外的空白格式。
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(`${JSON.stringify(body)}\n`);
}

function parseAppealPayload(payload: unknown): AppealCreateInput {
  // 这是 POST 的字段级信任边界：必填标识使用规范十进制字符串，未知字段不会进入持久化对象。
  if (!payload || typeof payload !== "object") {
    throw new Error("Appeal payload must be a JSON object.");
  }

  const record = payload as Record<string, unknown>;
  const tokenId = readRequiredDecimalString(record, "tokenId");
  const auditId = readRequiredDecimalString(record, "auditId");
  const auditIndex = readRequiredAuditIndex(record.auditIndex);
  const reason = readRequiredReason(record.reason);

  return {
    tokenId,
    auditId,
    auditIndex,
    reason,
    // 为兼容旧客户端，可选证据字段缺失或为空时直接省略，而不是写入空字符串占位。
    ...(readOptionalString(record.reportCID) ? { reportCID: readOptionalString(record.reportCID) } : {}),
    ...(readOptionalString(record.reportHash) ? { reportHash: readOptionalString(record.reportHash) } : {}),
    ...(readOptionalString(record.manifestUrl) ? { manifestUrl: readOptionalString(record.manifestUrl) } : {})
  };
}

function parseAppealLookupUrl(url: string): { tokenId: string; auditId: string } {
  // 固定的虚拟 origin 只用于解析相对 URL；它不会参与路由授权或外部网络访问。
  const parsed = new URL(url, "http://appeal.local");
  const tokenId = parsed.searchParams.get("tokenId");
  const auditId = parsed.searchParams.get("auditId");

  if (!tokenId || !/^\d+$/.test(tokenId.trim())) {
    throw new Error("tokenId must be a non-empty decimal string.");
  }

  if (!auditId || !/^\d+$/.test(auditId.trim())) {
    throw new Error("auditId must be a non-empty decimal string.");
  }

  return {
    tokenId: tokenId.trim(),
    auditId: auditId.trim()
  };
}

function parseAppealReviewPayload(payload: unknown): {
  review: AppealReviewInput;
  compensation?: {
    amount: string;
    reasonCode: string;
  };
} {
  // 审核负载与创建负载分开规范化，避免把调用方提供的任意字段直接合并进已持久化的 AppealTicket。
  if (!payload || typeof payload !== "object") {
    throw new Error("Appeal review payload must be a JSON object.");
  }

  const record = payload as Record<string, unknown>;
  const status = readReviewStatus(record.status);
  const reviewer = readNonEmptyString(record.reviewer, "reviewer");
  const reviewResult = readNonEmptyString(record.reviewResult, "reviewResult");

  const compensationTxHash = readOptionalString(record.compensationTxHash);

  // approved 分支强制提供补偿参数并以已配置执行器返回的交易哈希为准；外部传入哈希只作为兼容输入的初值。
  if (status === "approved") {
    const compensationAmount = readOptionalDecimalString(record.compensationAmount);
    const compensationReasonCode = readOptionalString(record.compensationReasonCode);

    if (!compensationAmount || !compensationReasonCode) {
      throw new Error("approved appeals require compensationAmount and compensationReasonCode.");
    }

    return {
      review: {
        status,
        reviewer,
        reviewResult,
        ...(compensationTxHash ? { compensationTxHash } : {})
      },
      compensation: {
        amount: compensationAmount,
        reasonCode: compensationReasonCode
      }
    };
  }

  // rejected 不发起补偿；若传入 compensationTxHash，当前协议仍会保留它，store 不负责验证其链上真实性。
  return {
    review: {
      status,
      reviewer,
      reviewResult,
      ...(compensationTxHash ? { compensationTxHash } : {})
    }
  };
}

function readRequiredDecimalString(
  record: Record<string, unknown>,
  field: "tokenId" | "auditId"
): string {
  const value = record[field];
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    throw new Error(`${field} must be a non-empty decimal string.`);
  }

  return value.trim();
}

function readRequiredAuditIndex(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("auditIndex must be a non-negative safe integer.");
  }

  return value;
}

function readRequiredReason(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("reason must be a non-empty string.");
  }

  return value.trim();
}

function readReviewStatus(value: unknown): "approved" | "rejected" {
  if (value === "approved" || value === "rejected") {
    return value;
  }

  throw new Error("status must be either approved or rejected.");
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  // 可选字段采用宽松兼容策略：类型错误与空值都按“未提供”处理，而非令整个请求失败。
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readOptionalDecimalString(value: unknown): string | undefined {
  return typeof value === "string" && /^\d+$/u.test(value.trim()) ? value.trim() : undefined;
}
