import type {
  AppealCompensationExecutor
} from "./appealCompensation";
import {
  createAppealReviewHandler,
  type AppealReviewHandler
} from "./appealReviewHandler";
import type {
  AppealReviewRecord,
  AppealReviewStatus
} from "./appealReviewTypes";
import type { AppealReviewStore } from "./appealReviewStore";

/**
 * API 层只依赖审核存储的查询与更新能力；状态迁移规则和补偿编排委托给 handler，实际落盘与并发语义归 store 所有。
 * now 与补偿依赖可注入，既提供测试确定性，也避免传输层直接持有链签名配置。
 */
export interface AppealReviewApiDependencies {
  readonly store: Pick<
    AppealReviewStore,
    "findById" | "update" | "listAll" | "listByStatus"
  >;
  readonly now?: () => Date;
  readonly compensateAppeal?: AppealCompensationExecutor;
  readonly compensationAmount?: string;
  readonly compensationReasonCode?: string;
}

interface ReviewRequestLike extends AsyncIterable<Buffer | string> {
  // 此抽象没有身份或授权字段：处理器必须挂载在已完成管理员认证与租户隔离的上游边界之后。
  method?: string;
  url?: string;
}

interface ReviewResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

const VALID_STATUSES: readonly AppealReviewStatus[] = [
  "pending",
  "under_review",
  "approved",
  "rejected"
];

function isValidStatusFilter(value: string): value is AppealReviewStatus {
  // 查询参数按已持久化的精确字面量匹配，不做大小写或别名归一化，以免过滤语义随客户端变化。
  return (VALID_STATUSES as readonly string[]).includes(value);
}

function parseAppealIdFromPath(
  url: string,
  suffix: string
): string | undefined {
  // suffix 仅由下方固定路由常量传入；若未来接收外部值，必须先转义再拼入 RegExp。
  const pattern = new RegExp(`^/appeals/([^/]+)${suffix}$`);
  const match = pattern.exec(url.split("?")[0]);
  if (!match || match[1].trim().length === 0) {
    return undefined;
  }

  // 解码后的 appealId 会进入存储查找；具体 store 必须把它当作不可信标识并约束其文件/租户边界。
  return decodeURIComponent(match[1]);
}

function isAppealDetailPath(url: string): boolean {
  const path = url.split("?")[0];
  return /^\/appeals\/[^/]+$/.test(path);
}

function parseAppealIdFromDetailPath(url: string): string {
  const path = url.split("?")[0];
  const match = /^\/appeals\/([^/]+)$/.exec(path);
  if (!match || match[1].trim().length === 0) {
    throw new Error("appealId is required.");
  }

  return decodeURIComponent(match[1]);
}

async function readJsonBody(request: ReviewRequestLike): Promise<unknown> {
  // 当前处理器聚合完整请求流且不检查 Content-Type/大小；生产反向代理必须提供字节上限、超时与速率控制。
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

function writeJson(
  response: ReviewResponseLike,
  statusCode: number,
  body: unknown
): void {
  // 显式设置单一响应媒体类型，并保留结尾换行这一现有 wire-format 兼容细节。
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(`${JSON.stringify(body)}\n`);
}

function readRequiredString(
  payload: Record<string, unknown>,
  field: string
): string {
  // reviewerAddress 与 note 在此仅按非空字符串验证；地址校验、身份绑定和备注内容策略应由受信上游完成。
  const value = payload[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalString(
  payload: Record<string, unknown>,
  field: string
): string | undefined {
  const value = payload[field];
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value.trim();
}

function buildHandler(deps: AppealReviewApiDependencies): AppealReviewHandler {
  // 每次操作构造无状态 handler；持久状态仍只存在于 deps.store，注入的 now/补偿策略在一次调用中保持一致。
  return createAppealReviewHandler({
    store: deps.store,
    now: deps.now,
    compensateAppeal: deps.compensateAppeal,
    compensationAmount: deps.compensationAmount,
    compensationReasonCode: deps.compensationReasonCode
  });
}

function formatRecord(record: AppealReviewRecord): Record<string, unknown> {
  // 响应采用字段白名单而非展开持久化对象，防止将来加入内部字段时被 API 无意公开；可选字段继续按缺省方式兼容旧客户端。
  return {
    appealId: record.appealId,
    eventKey: record.eventKey,
    tokenId: record.tokenId,
    status: record.status,
    reason: record.reason,
    slashReasonCode: record.slashReasonCode,
    originalAuditScore: record.originalAuditScore,
    createdAt: record.createdAt,
    ...(record.reviewerAddress
      ? { reviewerAddress: record.reviewerAddress }
      : {}),
    ...(record.reviewNote ? { reviewNote: record.reviewNote } : {}),
    ...(record.reviewedAt ? { reviewedAt: record.reviewedAt } : {}),
    ...(record.compensationTxHash
      ? { compensationTxHash: record.compensationTxHash }
      : {})
  };
}

function isNotFoundError(error: unknown): boolean {
  // HTTP 分类依赖 handler 的稳定错误前缀；改变领域错误文案时必须同步更新此兼容映射或改用结构化错误类型。
  return (
    error instanceof Error && error.message.startsWith("Appeal not found:")
  );
}

function isTransitionError(error: unknown): boolean {
  // 非法迁移被归为客户端错误；未匹配该前缀的存储/RPC 异常会进入各路由的通用 400/500 分支。
  return (
    error instanceof Error &&
    error.message.startsWith("Invalid status transition:")
  );
}

export async function handleAppealReviewRequest(
  request: ReviewRequestLike,
  response: ReviewResponseLike,
  deps: AppealReviewApiDependencies
): Promise<void> {
  // 本函数只做路由与序列化，不实施认证、CSRF 防护或租户授权；调用者必须在进入此信任边界前完成这些控制。
  const method = request.method ?? "";
  const url = request.url ?? "";
  const path = url.split("?")[0];

  // GET /appeals or GET /appeals?status=...
  if (method === "GET" && path === "/appeals") {
    try {
      const parsed = new URL(url, "http://review.local");
      const statusFilter = parsed.searchParams.get("status");

      if (statusFilter) {
        if (!isValidStatusFilter(statusFilter)) {
          writeJson(response, 400, {
            error: `Invalid status filter: "${statusFilter}". Must be one of: ${VALID_STATUSES.join(", ")}.`
          });
          return;
        }

        // 列表顺序完全沿用 store 返回值，API 不承诺按 createdAt 或 appealId 排序。
        const records = await deps.store.listByStatus(statusFilter);
        writeJson(
          response,
          200,
          records.map(formatRecord)
        );
        return;
      }

      const records = await deps.store.listAll();
      writeJson(
        response,
        200,
        records.map(formatRecord)
      );
    } catch (error) {
      writeJson(response, 500, {
        error:
          error instanceof Error
            ? error.message
            : "Failed to list appeals."
      });
    }

    return;
  }

  // GET /appeals/:appealId
  if (method === "GET" && isAppealDetailPath(url)) {
    try {
      const appealId = parseAppealIdFromDetailPath(url);
      const record = await deps.store.findById(appealId);

      if (!record) {
        writeJson(response, 404, { error: "Appeal not found." });
        return;
      }

      writeJson(response, 200, formatRecord(record));
    } catch (error) {
      // 该分支把 URI 解码和存储读取异常统一映射为 400；错误消息会原样进入响应，store 不应携带敏感路径或凭据。
      writeJson(response, 400, {
        error:
          error instanceof Error
            ? error.message
            : "Failed to read appeal."
      });
    }

    return;
  }

  // POST /appeals/:appealId/review
  if (method === "POST") {
    // 三个命令均依赖状态机拒绝重复迁移，而不是接受幂等键；客户端在超时后重试前应先 GET 当前状态。
    const reviewAppealId = parseAppealIdFromPath(url, "/review");
    if (reviewAppealId) {
      try {
        // JSON 结果只在读取具体字段时验证；未知字段被忽略，不会直接合并进审核记录。
        const payload = (await readJsonBody(request)) as Record<
          string,
          unknown
        >;
        const reviewerAddress = readRequiredString(payload, "reviewerAddress");
        const handler = buildHandler(deps);
        const result = await handler.startReview(
          reviewAppealId,
          reviewerAddress
        );
        writeJson(response, 200, formatRecord(result));
      } catch (error) {
        if (isNotFoundError(error)) {
          writeJson(response, 404, {
            error: (error as Error).message
          });
          return;
        }

        writeJson(response, 400, {
          error:
            error instanceof Error
              ? error.message
              : "Failed to start review."
        });
      }

      return;
    }

    // POST /appeals/:appealId/approve
    const approveAppealId = parseAppealIdFromPath(url, "/approve");
    if (approveAppealId) {
      try {
        const payload = (await readJsonBody(request)) as Record<
          string,
          unknown
        >;
        const reviewerAddress = readRequiredString(payload, "reviewerAddress");
        const note = readRequiredString(payload, "note");
        // 补偿与本地终态的先后顺序由 handler 定义；此 API 未注入链 writer，也不提供跨介质事务或重试队列。
        const handler = buildHandler(deps);
        const result = await handler.approveAppeal(
          approveAppealId,
          reviewerAddress,
          note
        );
        writeJson(response, 200, formatRecord(result));
      } catch (error) {
        if (isNotFoundError(error)) {
          writeJson(response, 404, {
            error: (error as Error).message
          });
          return;
        }

        if (isTransitionError(error)) {
          writeJson(response, 400, {
            error: (error as Error).message
          });
          return;
        }

        writeJson(response, 400, {
          error:
            error instanceof Error
              ? error.message
              : "Failed to approve appeal."
        });
      }

      return;
    }

    // POST /appeals/:appealId/reject
    const rejectAppealId = parseAppealIdFromPath(url, "/reject");
    if (rejectAppealId) {
      try {
        const payload = (await readJsonBody(request)) as Record<
          string,
          unknown
        >;
        const reviewerAddress = readRequiredString(payload, "reviewerAddress");
        const note = readRequiredString(payload, "note");
        // reject 与 approve 共享同一状态所有权，但不会触发补偿；具体副作用与失败策略仍由 handler 契约决定。
        const handler = buildHandler(deps);
        const result = await handler.rejectAppeal(
          rejectAppealId,
          reviewerAddress,
          note
        );
        writeJson(response, 200, formatRecord(result));
      } catch (error) {
        if (isNotFoundError(error)) {
          writeJson(response, 404, {
            error: (error as Error).message
          });
          return;
        }

        if (isTransitionError(error)) {
          writeJson(response, 400, {
            error: (error as Error).message
          });
          return;
        }

        writeJson(response, 400, {
          error:
            error instanceof Error
              ? error.message
              : "Failed to reject appeal."
        });
      }

      return;
    }
  }

  writeJson(response, 404, { error: "Not found." });
}
