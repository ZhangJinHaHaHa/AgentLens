export interface SandboxManifest {
  agent_name: string;
  image: string;
  allowed_hosts: string[];
  allowed_rpc_endpoints: string[];
}

export interface AuditHistoryMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AuditQuestionMeta {
  id: string;
  category: string;
  question: string;
  expectedBehavior: string;
}

export interface AuditSolveRequest {
  task_id: string;
  question: string;
  context: {
    current_block?: number;
    env_vars?: string[];
    history: AuditHistoryMessage[];
  };
  constraints: {
    max_steps?: number;
    forbidden_ips?: string[];
    response_format: "json";
  };
  questions?: AuditQuestionMeta[];
}

export interface AuditAction {
  type: string;
  url?: string;
  method?: string;
  params?: unknown[];
  payload?: Record<string, unknown>;
}

export interface AuditSolveResponse {
  answer: string;
  actions: AuditAction[];
  reasoning_summary?: string;
  usage?: Record<string, unknown>;
}

export interface NetworkConnectionEvidence {
  protocol: "tcp4";
  remoteIp: string;
  remotePort: number;
  state: string;
}

export interface NetworkEvidence {
  source: "procfs";
  observedAt: string;
  connections: NetworkConnectionEvidence[];
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

export interface LocalAuditResult {
  agentName: string;
  manifestHash: string;
  healthcheckPassed: boolean;
  answer: string;
  actions: AuditAction[];
  decisionType: AuditDecisionClassification["decisionType"];
  actionReconciliation?: AuditActionReconciliation;
  cpuAvgMilli: number;
  memoryPeakMb: number;
  requestedIps: string[];
  requestedHosts: string[];
  requestCount: number;
  networkEvidence?: NetworkEvidence;
  status: string;
  reasonCode?: string;
  startedAt: string;
  finishedAt: string;
  questions?: AuditQuestionMeta[];
  answerEvaluations?: AnswerEvaluationMeta[];
  securityBoundaryScore?: SecurityBoundaryMeta;
}

export interface AuditActionReconciliation {
  declaredHosts: string[];
  observedHosts: string[];
  undeclaredObservedHosts: string[];
  declaredUnobservedHosts: string[];
  reasonCode?: "ACTION_MISMATCH";
}

export interface AuditDecisionClassification {
  decisionType: "undetermined" | "ordinary_failure" | "redline_violation";
}

export interface AuditDecisionFacts {
  status: string;
  reasonCode?: string;
  answer?: string;
  actions?: AuditAction[];
}
