/**
 * 详细审计报告的完整性读取边界：按 CID 从网关取回原始文本，先计算 SHA-256 与预期链上哈希比较，再解析为报告并返回来源 URL。
 * 输入包含 CID、可信锚点哈希和可注入 fetch/gateway；输出区分缺失、HTTP 不可得、抓取失败、哈希不符及 JSON 非法等可展示故障。
 * 调用会访问网络和 Web Crypto，但不缓存、无超时、无镜像网关回退或自动重试；响应读取/加密平台级异常仍可能以 Promise rejection 传播。
 * IPFS 网关和报告正文完全不可信，只有哈希匹配后才允许解析；预期哈希本身必须来自权威链读取，客户端布尔结果不能替代服务端证据验证。
 * JSON 目前只做语法解析并以类型断言返回，不验证 schemaVersion、字段范围或嵌套形状，渲染外部字符串时仍需转义并容忍缺字段。
 * CID 会裁剪并作为单一路径段编码，`0x`/大小写哈希被规范化；这种比较规则及原文逐字哈希是历史报告兼容不变量。
 */
export interface AuditQuestionMeta {
  id: string;
  category: string;
  question: string;
  expectedBehavior: string;
}

export interface AnswerEvaluationMeta {
  questionId: string;
  category: string;
  score: number;
  passed: boolean;
  reasoning: string;
  securityFlags: string[];
}

export interface SecurityBoundaryMeta {
  score: number;
  hasAuthBoundary: boolean;
  privilegeEscalationResistant: boolean;
  flags: string[];
}

export interface DimensionalScoresMeta {
  dimensions: {
    security: number;
    task_execution: number;
    cognitive: number;
    environment: number;
    engineering: number;
    compliance: number;
  };
  overallScore: number;
}

export interface DetailedAuditReport {
  schemaVersion: "audit-report.v1" | "audit-report.v2";
  agentName: string;
  manifestHash: string;
  status: string;
  decisionType: string;
  reasonCode?: string;
  healthcheckPassed: boolean;
  resourceMetrics: {
    cpuAvgMilli: number;
    memoryPeakMb: number;
  };
  networkActivity: {
    requestedIps: string[];
    requestedHosts: string[];
    requestCount: number;
  };
  auditQuestions?: AuditQuestionMeta[];
  answerEvaluations?: AnswerEvaluationMeta[];
  securityBoundaryScore?: SecurityBoundaryMeta;
  dimensionalScores?: DimensionalScoresMeta;
  responseTrace: {
    answer: string;
    actions: Array<{ type: string; [key: string]: unknown }>;
    reconciliation?: {
      declaredHosts: string[];
      observedHosts: string[];
      undeclaredObservedHosts: string[];
      declaredUnobservedHosts: string[];
    };
  };
  timestamps: {
    startedAt: string;
    finishedAt: string;
  };
}

export type AuditReportReadErrorCode =
  | "REPORT_UNAVAILABLE"
  | "REPORT_NOT_FOUND"
  | "HASH_MISMATCH"
  | "INVALID_REPORT_JSON"
  | "REPORT_FETCH_FAILED";

export type AuditReportReadResult =
  | {
      ok: true;
      report: DetailedAuditReport;
      reportJson: string;
      sourceUrl: string;
    }
  | {
      ok: false;
      errorCode: AuditReportReadErrorCode;
      error: string;
      sourceUrl?: string;
    };

export interface AuditReportClient {
  readReportByCid(args: {
    reportCID: string;
    expectedReportHash: string;
  }): Promise<AuditReportReadResult>;
}

interface CreateAuditReportClientOptions extends ReadAuditReportByCidDependencies {}

interface ReadAuditReportByCidOptions {
  reportCID: string;
  expectedReportHash: string;
}

interface ReadAuditReportByCidDependencies {
  fetchImpl?: typeof fetch;
  gatewayBaseUrl?: string;
}

const DEFAULT_IPFS_GATEWAY_BASE_URL = "https://ipfs.io/ipfs/";

export async function readAuditReportByCid(
  { reportCID, expectedReportHash }: ReadAuditReportByCidOptions,
  {
    fetchImpl = fetch,
    gatewayBaseUrl = DEFAULT_IPFS_GATEWAY_BASE_URL
  }: ReadAuditReportByCidDependencies = {}
): Promise<AuditReportReadResult> {
  const trimmedCid = reportCID.trim();
  if (trimmedCid.length === 0) {
    return {
      ok: false,
      errorCode: "REPORT_UNAVAILABLE",
      error: "This audit summary does not include a report CID yet."
    };
  }

  const sourceUrl = buildIpfsGatewayUrl(trimmedCid, gatewayBaseUrl);

  let response: Response;
  try {
    response = await fetchImpl(sourceUrl);
  } catch {
    return {
      ok: false,
      errorCode: "REPORT_FETCH_FAILED",
      error: "Failed to fetch the detailed audit report.",
      sourceUrl
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      errorCode: "REPORT_NOT_FOUND",
      error: "The detailed audit report could not be fetched from the gateway.",
      sourceUrl
    };
  }

  const reportJson = await response.text();
  const actualHash = await computeSha256Hex(reportJson);
  if (normalizeHash(actualHash) !== normalizeHash(expectedReportHash)) {
    return {
      ok: false,
      errorCode: "HASH_MISMATCH",
      error: "Detailed audit report hash verification failed.",
      sourceUrl
    };
  }

  try {
    const report = JSON.parse(reportJson) as DetailedAuditReport;

    return {
      ok: true,
      report,
      reportJson,
      sourceUrl
    };
  } catch {
    return {
      ok: false,
      errorCode: "INVALID_REPORT_JSON",
      error: "The detailed audit report response is not valid JSON.",
      sourceUrl
    };
  }
}

export function createAuditReportClient(
  options: CreateAuditReportClientOptions = {}
): AuditReportClient {
  return {
    readReportByCid(args) {
      return readAuditReportByCid(args, options);
    }
  };
}

function buildIpfsGatewayUrl(reportCID: string, gatewayBaseUrl: string): string {
  const normalizedBaseUrl = gatewayBaseUrl.endsWith("/") ? gatewayBaseUrl : `${gatewayBaseUrl}/`;
  return `${normalizedBaseUrl}${encodeURIComponent(reportCID)}`;
}

async function computeSha256Hex(input: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeHash(hash: string): string {
  return hash.replace(/^0x/i, "").toLowerCase();
}
