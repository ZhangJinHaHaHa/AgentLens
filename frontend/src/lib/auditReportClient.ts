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
