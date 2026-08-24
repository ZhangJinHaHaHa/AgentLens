/**
 * 申诉 HTTP 边界：把 bigint 标识序列化为十进制字符串后提交 JSON，并按 token/audit 查询最新申诉，输出不抛业务错误的可判别结果。
 * POST 会携带用户理由和可选报告/manifest 证据，GET 使用 URL 查询参数；两者均产生网络副作用，但不缓存、不中止，也不自动重试。
 * endpoint 和响应 JSON 均不可信，客户端只提取非空字符串；后端必须独立完成身份、所有权、长度、证据绑定和状态转换校验。
 * 传输异常与非成功状态返回稳定错误，查询 404 单独标为 NOT_FOUND；非 JSON 或畸形成功体采用 `reviewing` 兼容默认值，而不伪造 appealId。
 * `fetchImpl` 注入用于测试/宿主适配，重试必须由上层按幂等语义决定，尤其不能在首次 POST 结果未知时盲目重复创建申诉。
 */
export interface AppealSubmissionInput {
  tokenId: bigint;
  auditId: bigint;
  auditIndex: number;
  reason: string;
  reportCID?: string;
  reportHash?: string;
  manifestUrl?: string;
}

export type AppealSubmissionResult =
  | {
      ok: true;
      appealId?: string;
      status: string;
    }
  | {
      ok: false;
      error: string;
    };

export type AppealReadResult =
  | {
      ok: true;
      appealId?: string;
      status: string;
      createdAt?: string;
    }
  | {
      ok: false;
      errorCode: "NOT_FOUND" | "FETCH_FAILED";
      error: string;
    };

export interface AppealClient {
  submitAppeal(input: AppealSubmissionInput): Promise<AppealSubmissionResult>;
  readLatestAppeal(input: {
    tokenId: bigint;
    auditId: bigint;
  }): Promise<AppealReadResult>;
}

interface SubmitAppealDependencies {
  endpointUrl: string;
  fetchImpl?: typeof fetch;
}

export async function submitAppeal(
  input: AppealSubmissionInput,
  { endpointUrl, fetchImpl = fetch }: SubmitAppealDependencies
): Promise<AppealSubmissionResult> {
  let response: Response;

  try {
    response = await fetchImpl(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tokenId: String(input.tokenId),
        auditId: String(input.auditId),
        auditIndex: input.auditIndex,
        reason: input.reason,
        ...(input.reportCID ? { reportCID: input.reportCID } : {}),
        ...(input.reportHash ? { reportHash: input.reportHash } : {}),
        ...(input.manifestUrl ? { manifestUrl: input.manifestUrl } : {})
      })
    });
  } catch {
    return {
      ok: false,
      error: "Failed to submit the appeal request."
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: (await readErrorMessage(response)) ?? "The appeal request was rejected."
    };
  }

  const payload = await readJsonPayload(response);

  return {
    ok: true,
    appealId: readStringField(payload, "appealId"),
    status: readStringField(payload, "status") ?? "reviewing"
  };
}

export async function readLatestAppeal(
  input: {
    tokenId: bigint;
    auditId: bigint;
  },
  { endpointUrl, fetchImpl = fetch }: SubmitAppealDependencies
): Promise<AppealReadResult> {
  const url = new URL(endpointUrl);
  url.searchParams.set("tokenId", String(input.tokenId));
  url.searchParams.set("auditId", String(input.auditId));

  let response: Response;

  try {
    response = await fetchImpl(url.toString());
  } catch {
    return {
      ok: false,
      errorCode: "FETCH_FAILED",
      error: "Failed to load appeal status."
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      errorCode: "NOT_FOUND",
      error: (await readErrorMessage(response)) ?? "Appeal not found."
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      errorCode: "FETCH_FAILED",
      error: (await readErrorMessage(response)) ?? "Failed to load appeal status."
    };
  }

  const payload = await readJsonPayload(response);

  return {
    ok: true,
    appealId: readStringField(payload, "appealId"),
    status: readStringField(payload, "status") ?? "reviewing",
    createdAt: readStringField(payload, "createdAt")
  };
}

export function createAppealSubmissionClient(
  dependencies: SubmitAppealDependencies
): AppealClient {
  return {
    submitAppeal(input) {
      return submitAppeal(input, dependencies);
    },
    readLatestAppeal(input) {
      return readLatestAppeal(input, dependencies);
    }
  };
}

async function readErrorMessage(response: Response): Promise<string | undefined> {
  const payload = await readJsonPayload(response);
  return readStringField(payload, "error") ?? readStringField(payload, "message");
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return undefined;
  }

  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function readStringField(payload: unknown, field: string): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
