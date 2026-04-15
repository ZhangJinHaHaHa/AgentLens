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
