/**
 * 该模块在容器启动后轮询约定的健康端点，并仅在 HTTP 成功且 JSON status 为 ok 时放行；不检测业务正确性、资源配额或出口策略。
 * host/port、重试次数、间隔和可注入 fetch 构成输入，成功以 Promise 完成表示，耗尽尝试则抛出带稳定 reasonCode 的 AgentUnavailableError。
 * HTTP 响应和 JSON 体来自不可信容器网络；连接异常、非 JSON、非 2xx 与错误状态都会被保留为最后原因，但对外统一失败关闭。
 * 每个调用维护独立重试状态并串行发请求，尝试之间仅固定等待；这里不提供单请求超时或取消，调用方需用更外层生命周期限制总体等待。
 */
import { HEALTHCHECK_PATH } from "../config/constants";

export class AgentUnavailableError extends Error {
  readonly reasonCode = "AGENT_UNAVAILABLE";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AgentUnavailableError";
  }
}

export type FetchLike = typeof fetch;

export interface HealthcheckOptions {
  host: string;
  port: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  fetchImpl?: FetchLike;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForHealth(options: HealthcheckOptions): Promise<void> {
  const {
    host,
    port,
    maxAttempts = 5,
    retryDelayMs = 500,
    fetchImpl = fetch
  } = options;
  const url = `http://${host}:${port}${HEALTHCHECK_PATH}`;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(url);
      const body = (await response.json()) as { status?: string };

      if (response.ok && body.status === "ok") {
        return;
      }

      lastError = new Error(`Unexpected healthcheck response: ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < maxAttempts) {
      await sleep(retryDelayMs);
    }
  }

  throw new AgentUnavailableError(`Agent healthcheck failed for ${url}`, { cause: lastError });
}
