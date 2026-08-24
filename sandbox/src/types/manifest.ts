/**
 * 这里定义 manifest、审计请求/响应、网络证据、评价元数据与本地结果的共享线格式，使加载、运行、监控和报告模块使用同一领域词汇；不做运行时校验或序列化。
 * 这些对象常由文件、HTTP、容器或链下模型产生，静态类型不能跨越信任边界，入口仍须使用 schema/解析器验证并限制大小与 URL。
 * cpuAvgMilli、memoryPeakMb、ISO 时间、reasonCode、哈希及 action 字段的名称/单位被持久报告和测试共同依赖，变更需考虑向后兼容。
 * 接口本身无状态、I/O 或并发语义；可选字段表示证据可能未采集，不代表空值通过，消费者必须依据 status 与采集来源做保守解释。
 */
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
