import type { I18nText } from "./i18nText";
import { isNonZeroHash } from "@/lib/chainEvidence";

export type AgentSource = "marketplace" | "curated" | "listed" | "native";

export type AgentProductType =
  | "marketplace_agent"
  | "large_model_assistant"
  | "agent_platform"
  | "workflow_agent"
  | "coding_agent"
  | "vertical_ai_tool";

export type RiskLevel = "low" | "medium" | "high";
export type Complexity = "low" | "medium" | "high";

export type AccessType = "api" | "saas" | "cli" | "browser_ext" | "local" | "cloud";

export type TrustTier = 0 | 1 | 2 | 3;

export type AgentWorkspaceMapFit =
  | "main"
  | "code"
  | "browser"
  | "workflow"
  | "data"
  | "creative"
  | "official-only";

export type AgentCapabilityInputType = "text" | "voice" | "image" | "file" | "url" | "dataset" | "repo";

export type AgentCapabilityOutputType =
  | "text"
  | "report"
  | "table"
  | "chart"
  | "file"
  | "patch"
  | "workflow"
  | "image"
  | "audio";

export type AgentCapabilityTool =
  | "model"
  | "web-search"
  | "web-fetch"
  | "file-parser"
  | "ocr"
  | "code-runner"
  | "browser"
  | "workflow-api"
  | "remote-runtime"
  | "audit-log";

export type AgentRuntimeMode =
  | "managed-runtime"
  | "seller-api"
  | "external-adapter"
  | "model-gateway"
  | "official-only";

export type AgentSupportLevel = "full" | "partial" | "jump-out" | "unsupported";

export type AgentPermissionNeed =
  | "login"
  | "external-account"
  | "submit-form"
  | "payment"
  | "file-access"
  | "repo-access"
  | "browser-session";

export type AgentPricingMode = "free-trial" | "per-run" | "per-token" | "per-tool" | "seller-defined";

export type AgentTrustSignal = "audit" | "reputation" | "chain-proof" | "sample-output" | "seller-verified";

export type AgentCapabilityModuleNarrativeId =
  | "task_chat"
  | "files_knowledge"
  | "code_repo"
  | "browser_action"
  | "workflow_tools"
  | "api_connector"
  | "media_generation"
  | "enterprise_knowledge"
  | "audit_metering";

export type AgentCapabilityModuleNarrativeStatus =
  | "ready"
  | "testable"
  | "needs_adapter"
  | "needs_runtime"
  | "replacement_needed"
  | "official_only";

export interface AgentCapabilityModuleNarrative {
  id: AgentCapabilityModuleNarrativeId;
  status: AgentCapabilityModuleNarrativeStatus;
  label: I18nText;
  description: I18nText;
  caveats?: I18nText[];
  privacyNote?: I18nText;
  testPrompt?: I18nText;
}

export type AgentDemoVideoStatus = "available" | "planned";

export interface AgentDemoVideo {
  title: I18nText;
  summary: I18nText;
  status: AgentDemoVideoStatus;
  videoUrl?: string;
  posterUrl?: string;
  durationLabel?: I18nText;
  transcript?: I18nText[];
}

export interface AgentCapabilityContract {
  /** Which workspace map should host this Agent first. */
  mapFit: AgentWorkspaceMapFit;
  inputTypes: AgentCapabilityInputType[];
  outputTypes: AgentCapabilityOutputType[];
  requiredTools: AgentCapabilityTool[];
  runtimeMode: AgentRuntimeMode;
  mobileSupport: AgentSupportLevel;
  desktopSupport: AgentSupportLevel;
  permissionNeeds: AgentPermissionNeed[];
  pricingMode: AgentPricingMode;
  trustSignals: AgentTrustSignal[];
  knownLimits?: I18nText[];
  /**
   * Up to three concrete buyer-facing tasks shown as quick-start chips in the
   * workspace canvas when idle. Keep them action-verb + object, e.g.
   * { zh: "总结一份合同", en: "Summarise a contract" }.
   */
  typicalTasks?: I18nText[];
  /** Public workspace module copy used by cards and detail pages. */
  moduleNarratives?: AgentCapabilityModuleNarrative[];
}

export type AgentWorkspaceAdmissionStatus =
  | "workspace_runnable"
  | "pending_validation"
  | "adapter_plan"
  | "official_only";

export type AgentWorkspaceAdmissionSource =
  | "hosted_catalog"
  | "platform_catalog"
  | "external_adapter"
  | "model_gateway"
  | "editorial";

export interface AgentWorkspaceAdmission {
  status: AgentWorkspaceAdmissionStatus;
  source: AgentWorkspaceAdmissionSource;
  /** True only after the platform has enough evidence to open the buyer workspace. */
  canOpenWorkspace: boolean;
  packageGateStatus?: "draft" | "adapter_plan" | "smoke_pending" | "workspace_runnable";
}

/**
 * Who is behind a marketplace agent. The buyer is really comparing SELLERS —
 * a big firm's agent and a solo practitioner's agent differ in the depth,
 * scale and provenance of the private context that backs them, even within the
 * same category. `kind` drives the badge; `label`/`contextScale` say who they
 * are and what corpus stands behind the service.
 */
export type SellerKind = "solo" | "boutique" | "firm" | "institution" | "platform";

export interface SellerProfile {
  kind: SellerKind;
  /** Who the seller is, e.g. "金衡律师事务所 · 200+ 律师". */
  label: I18nText;
  /** What private context stands behind it, e.g. "十万级案卷库". */
  contextScale: I18nText;
}

export interface ScenarioRef {
  /** Stable identifier — also drives the URL filter and i18n key. */
  id: string;
  label: I18nText;
}

export interface AgentChainEvidence {
  /** True when the latest audit record passed (status === 1). */
  auditPassed?: boolean;
  /** Non-zero report hash on the latest audit record. */
  reportHash?: string;
  /** Non-zero attestation hash recorded by the listener. */
  attestationHash?: string;
  /** Latest on-chain reputation score. V3 stores this on a 0-10000 scale. */
  reputationScore?: number;
  /** Token id minted by the registry. Mirror of `tokenId` for convenience. */
  tokenId?: string;
  /** Last audit unix timestamp in seconds, useful for sorting. */
  lastAuditAt?: number;
  /** Number of audits ever recorded for this token. */
  auditCount?: number;
}

export interface AgentNativePricing {
  /** Free-form pricing label (e.g. "$0.05 / 1K req"). */
  label?: I18nText;
  /** Whether the agent is rentable on the platform marketplace. */
  rentable?: boolean;
}

export type AgentRuntimeSecurityKind = "platform_image" | "seller_runtime" | "external_tool";

export interface AgentRuntimeSecurity {
  kind: AgentRuntimeSecurityKind;
  label: I18nText;
  description: I18nText;
  /** Short factual evidence label, e.g. "image recognized". */
  evidenceLabel?: I18nText;
}

export type AgentCustodyProtocol =
  | "platform_sandbox"
  | "managed_gateway"
  | "seller_api"
  | "official_redirect";

export type AgentVendorVerification =
  | "platform_owned"
  | "verified_vendor"
  | "seller_verified"
  | "unverified";

export type AgentAuditDisclosureMode =
  | "sandbox_audit"
  | "black_box_evidence"
  | "run_trace"
  | "directory_only";

export type AgentSettlementMode =
  | "managed_credit_internal"
  | "managed_credit_revenue_share"
  | "managed_credit_gateway_fee"
  | "none";

export interface AgentRuntimeProtocol {
  custodyProtocol: AgentCustodyProtocol;
  vendorVerification: AgentVendorVerification;
  auditDisclosureMode: AgentAuditDisclosureMode;
  settlementMode: AgentSettlementMode;
  label: I18nText;
  description: I18nText;
  dataRetentionPolicy: I18nText;
}

export interface AgentBuyerCardMetadata {
  /** Buyer-facing task chips. Prefer three concrete jobs over generic tags. */
  tasks?: I18nText[];
  /** What the user receives after running/buying this Agent. */
  deliverable?: I18nText;
  /** Explicit buyer boundary so the card does not oversell. */
  notFor?: I18nText;
  /** Where/how the Agent runs today or after platform connection. */
  runMode?: I18nText;
  /** Where user data goes during the task. */
  dataBoundary?: I18nText;
  /** Why this is more than asking a generic model. */
  differentiation?: I18nText;
}

export interface AgentCatalogEntry {
  /** Stable string id. For native agents this matches `tokenId`. */
  id: string;
  source: AgentSource;
  name: string;
  vendor?: string;
  /** Marketplace agents: structured seller provenance for side-by-side compare. */
  seller?: SellerProfile;
  intro: I18nText;
  category: string;
  tags: string[];
  scenarios: ScenarioRef[];
  unsuitableScenarios: ScenarioRef[];
  recommendedFor: I18nText[];
  riskLevel: RiskLevel;
  riskNotes: I18nText[];
  /** Optional mitigation copy paired with the risk notes. */
  riskMitigation?: I18nText[];
  accessTypes: AccessType[];
  complexity: Complexity;
  hasOnboardingGuide: boolean;
  officialUrl?: string;
  docsUrl?: string;
  pricingHint?: I18nText;
  pricingUrl?: string;
  /** Native-only: maps to the on-chain tokenId. */
  tokenId?: string;
  /** Curated/listed: most recent observation timestamp (ISO date). */
  latestObservedAt?: string;
  /** Curated/listed: short observation summary the timeline can fall back to. */
  observationSummary?: I18nText;
  /** Editorial Tier hint, only used when the rule engine cannot determine a tier deterministically. */
  trustTierHint?: TrustTier;
  /** Optional chain evidence (populated for native or merged native+curated). */
  chainEvidence?: AgentChainEvidence;
  /** Native-only pricing extension. */
  nativePricing?: AgentNativePricing;
  /** Optional editorial tagline shown above the intro on the detail page. */
  tagline?: I18nText;
  /** Product-card copy that turns technical metadata into buyer-readable information. */
  buyerCard?: AgentBuyerCardMetadata;
  /** Buyer-visible runtime boundary signal. This is not a platform security endorsement. */
  runtimeSecurity?: AgentRuntimeSecurity;
  /** Machine-readable runtime/custody protocol used by cards, details and future enforcement. */
  runtimeProtocol?: AgentRuntimeProtocol;
  /** Structured contract used by cards, workspace routing and future runners. */
  capabilityContract?: AgentCapabilityContract;
  /** Machine-readable admission gate. Do not infer workspace access from ids or display tags. */
  workspaceAdmission?: AgentWorkspaceAdmission;
  /** Buyer-facing product demos shown in the dedicated demo tab. */
  demoVideos?: AgentDemoVideo[];
}

interface MergeOptions {
  /** Index of native agents by id (preferred merge key). */
  nativeById: Map<string, AgentCatalogEntry>;
  /** Index of native agents by lowercased name (fallback merge key). */
  nativeByName: Map<string, AgentCatalogEntry>;
}

export interface MergeCatalogInput {
  curated: readonly AgentCatalogEntry[];
  listed: readonly AgentCatalogEntry[];
  native: readonly AgentCatalogEntry[];
  /**
   * Seller-listed expert agents (private accumulated context). Optional so
   * existing callers/tests that predate the marketplace tier keep compiling.
   */
  marketplace?: readonly AgentCatalogEntry[];
}

export interface MergedCatalog {
  entries: AgentCatalogEntry[];
  byId: Map<string, AgentCatalogEntry>;
  bySource: Record<AgentSource, AgentCatalogEntry[]>;
}

function buildNativeIndexes(native: readonly AgentCatalogEntry[]): MergeOptions {
  const nativeById = new Map<string, AgentCatalogEntry>();
  const nativeByName = new Map<string, AgentCatalogEntry>();
  for (const entry of native) {
    nativeById.set(entry.id, entry);
    if (entry.name) {
      nativeByName.set(entry.name.trim().toLowerCase(), entry);
    }
  }
  return { nativeById, nativeByName };
}

function findNativeMatch(entry: AgentCatalogEntry, options: MergeOptions): AgentCatalogEntry | undefined {
  if (entry.tokenId) {
    const direct = options.nativeById.get(entry.tokenId);
    if (direct) return direct;
  }
  const direct = options.nativeById.get(entry.id);
  if (direct) return direct;
  if (entry.name) {
    return options.nativeByName.get(entry.name.trim().toLowerCase());
  }
  return undefined;
}

function mergeNativeInto(curated: AgentCatalogEntry, native: AgentCatalogEntry): AgentCatalogEntry {
  return {
    ...curated,
    tokenId: native.tokenId ?? curated.tokenId,
    chainEvidence: { ...curated.chainEvidence, ...native.chainEvidence },
    nativePricing: { ...curated.nativePricing, ...native.nativePricing },
    accessTypes: Array.from(new Set([...curated.accessTypes, ...native.accessTypes])),
    tags: Array.from(new Set([...curated.tags, ...native.tags])),
    /*
     * The curated entry already owns a deeply-edited intro/scenarios/risk story,
     * so we keep those intact even when the on-chain registry knows the agent
     * by another name. We DO surface chain evidence so trustTier can promote.
     */
    source: curated.source
  };
}

/**
 * Combine marketplace, curated, listed and native sources into one ordered list.
 *
 * Ordering: marketplace → curated → listed → native (only the natives that
 * didn't merge into another entry). Marketplace (seller-listed expert agents)
 * leads so the platform's core inventory surfaces first. Within each bucket we
 * keep the input order so editors stay in control of what surfaces first.
 */
export function mergeCatalog({ curated, listed, native, marketplace = [] }: MergeCatalogInput): MergedCatalog {
  const indexes = buildNativeIndexes(native);
  const consumedNativeIds = new Set<string>();

  const mergeBucket = (entry: AgentCatalogEntry): AgentCatalogEntry => {
    const match = findNativeMatch(entry, indexes);
    if (match) {
      consumedNativeIds.add(match.id);
      return mergeNativeInto(entry, match);
    }
    return entry;
  };

  const mergedMarketplace: AgentCatalogEntry[] = marketplace.map(mergeBucket);
  const mergedCurated: AgentCatalogEntry[] = curated.map(mergeBucket);
  const mergedListed: AgentCatalogEntry[] = listed.map(mergeBucket);

  const remainingNative = native.filter((entry) => !consumedNativeIds.has(entry.id));

  const entries = [...mergedMarketplace, ...mergedCurated, ...mergedListed, ...remainingNative];

  const byId = new Map<string, AgentCatalogEntry>();
  for (const entry of entries) {
    byId.set(entry.id, entry);
    if (entry.tokenId && !byId.has(entry.tokenId)) {
      byId.set(entry.tokenId, entry);
    }
  }

  return {
    entries,
    byId,
    bySource: {
      marketplace: mergedMarketplace,
      curated: mergedCurated,
      listed: mergedListed,
      native: remainingNative
    }
  };
}

export function isNativeEntry(entry: AgentCatalogEntry): boolean {
  return entry.source === "native" || Boolean(entry.tokenId);
}

const PRODUCT_TYPE_BY_ID: Record<string, AgentProductType> = {
  "claude-code": "coding_agent",
  codex: "coding_agent",
  cursor: "coding_agent",
  v0: "coding_agent",
  lovable: "coding_agent",
  devin: "coding_agent",
  "replit-agent": "coding_agent",
  "bolt-new": "coding_agent",
  "continue-dev": "coding_agent",
  openhands: "coding_agent",
  aider: "coding_agent",
  "github-copilot": "coding_agent",
  windsurf: "coding_agent",

  "openai-gpt5": "large_model_assistant",
  "google-gemini": "large_model_assistant",
  "microsoft-copilot": "large_model_assistant",
  claude: "large_model_assistant",
  deepseek: "large_model_assistant",
  kimi: "large_model_assistant",
  "qwen-agent": "large_model_assistant",
  poe: "large_model_assistant",

  dify: "agent_platform",
  "langgraph-platform": "agent_platform",
  "crewai-platform": "agent_platform",
  "autogen-studio": "agent_platform",
  flowise: "agent_platform",
  "vellum-ai": "agent_platform",
  "relevance-ai": "agent_platform",
  "stack-ai": "agent_platform",
  coze: "agent_platform",
  chatbase: "agent_platform",
  dust: "agent_platform",
  "browser-use": "agent_platform",
  composio: "agent_platform",

  "zapier-agents": "workflow_agent",
  "n8n-ai": "workflow_agent",
  openclaw: "workflow_agent",
  manus: "workflow_agent",
  "openai-operator": "workflow_agent",
  "relay-app": "workflow_agent",
  "zapier-interfaces-chatbots": "workflow_agent",

  perplexity: "vertical_ai_tool",
  "gpt-researcher": "vertical_ai_tool",
  "browser-use-readonly": "vertical_ai_tool",
  docsgpt: "vertical_ai_tool",
  "you-com": "vertical_ai_tool",
  "notion-ai": "vertical_ai_tool",
  "meeting-digest": "vertical_ai_tool",
  midjourney: "vertical_ai_tool",
  "intercom-fin": "vertical_ai_tool",
  elevenlabs: "vertical_ai_tool",
  harvey: "vertical_ai_tool",
  "jasper-ai": "vertical_ai_tool",
  runway: "vertical_ai_tool",
  synthesia: "vertical_ai_tool",
  glean: "vertical_ai_tool",
  genspark: "vertical_ai_tool",
  notebooklm: "vertical_ai_tool",
  gamma: "vertical_ai_tool",
  "canva-magic-studio": "vertical_ai_tool"
};

export function getAgentProductType(entry: AgentCatalogEntry): AgentProductType {
  if (entry.source === "marketplace" || entry.source === "native" || entry.id.startsWith("hst-")) {
    return "marketplace_agent";
  }

  const mapped = PRODUCT_TYPE_BY_ID[entry.id];
  if (mapped) return mapped;

  const text = [
    entry.category,
    entry.name,
    entry.vendor,
    ...entry.tags,
    ...entry.scenarios.flatMap((scenario) => [scenario.id, scenario.label.zh, scenario.label.en])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(coding|code|developer|ide|programmer|engineering|terminal|vscode)\b/.test(text)) {
    return "coding_agent";
  }
  if (/\b(agent-builder|agent platform|llm app|framework|orchestration|multi-agent|tool-use|mcp|low-code)\b/.test(text)) {
    return "agent_platform";
  }
  if (/\b(workflow|automation|operations|approval|browser|computer-use|web-agent)\b/.test(text)) {
    return "workflow_agent";
  }
  if (/\b(llm|general assistant|multimodal|reasoning|long-context|multi-model)\b/.test(text)) {
    return "large_model_assistant";
  }
  return "vertical_ai_tool";
}

const PLATFORM_IMAGE_RUNTIME_SECURITY: AgentRuntimeSecurity = {
  kind: "platform_image",
  label: { zh: "平台镜像已识别", en: "Platform image recognized" },
  description: {
    zh: "卖家已提交 Docker 镜像，平台可在云端受控运行。",
    en: "The seller submitted a Docker image, so the platform can run it in a controlled cloud runtime."
  },
  evidenceLabel: { zh: "镜像已识别", en: "Image recognized" }
};

const SELLER_HOSTED_RUNTIME_SECURITY: AgentRuntimeSecurity = {
  kind: "seller_runtime",
  label: { zh: "未识别镜像", en: "Image not recognized" },
  description: {
    zh: "平台未识别到 Docker 镜像，买家输入可能暴露给卖家运行环境。",
    en: "The platform has not recognized a Docker image, so buyer input may be exposed to the seller runtime."
  }
};

const EXTERNAL_TOOL_RUNTIME_SECURITY: AgentRuntimeSecurity = {
  kind: "external_tool",
  label: { zh: "外部工具 / 不适用", en: "External tool / N/A" },
  description: {
    zh: "这是平台目录中的外部工具，平台不判断其 Docker 镜像运行边界。",
    en: "This is an external tool in the directory, so the platform does not judge its Docker image runtime boundary."
  }
};

export function getRuntimeSecurity(entry: AgentCatalogEntry): AgentRuntimeSecurity {
  if (entry.runtimeSecurity) return entry.runtimeSecurity;
  if (isNativeEntry(entry)) return PLATFORM_IMAGE_RUNTIME_SECURITY;
  if (entry.source === "marketplace") return SELLER_HOSTED_RUNTIME_SECURITY;
  return EXTERNAL_TOOL_RUNTIME_SECURITY;
}

export function getRuntimeProtocol(entry: AgentCatalogEntry): AgentRuntimeProtocol {
  if (entry.runtimeProtocol) return entry.runtimeProtocol;

  const runtime = getRuntimeSecurity(entry);
  const contractRuntime = entry.capabilityContract?.runtimeMode;
  const access = new Set(entry.accessTypes);

  if (isPlatformSandboxCandidate(entry)) {
    return {
      custodyProtocol: "platform_sandbox",
      vendorVerification: "platform_owned",
      auditDisclosureMode: "black_box_evidence",
      settlementMode: "managed_credit_revenue_share",
      label: {
        zh: "平台托管准备中 · 尚未沙箱审计",
        en: "Platform hosting in progress · sandbox audit pending"
      },
      description: {
        zh: "平台计划把该 Agent 接入隔离运行时；接通前只展示托管候选和能力边界，不承诺真实沙箱运行。",
        en: "AgentLens plans to connect this Agent to an isolated runtime. Before that is done, it is a hosted candidate only and is not promised as a live sandbox run."
      },
      dataRetentionPolicy: {
        zh: "接通前不处理用户真实任务；接通后需要进入私有运行记录和公开审计投影两层存储。",
        en: "Before integration it should not process real user tasks. After integration it needs private run records plus a public audit projection."
      }
    };
  }

  if (runtime.kind === "platform_image" || isNativeEntry(entry)) {
    return {
      custodyProtocol: "platform_sandbox",
      vendorVerification: entry.source === "marketplace" ? "seller_verified" : "platform_owned",
      auditDisclosureMode: "sandbox_audit",
      settlementMode: entry.source === "marketplace" ? "managed_credit_revenue_share" : "managed_credit_internal",
      label: {
        zh: "平台托管运行 · 行为可审计",
        en: "Managed runtime · auditable behavior"
      },
      description: {
        zh: "Agent 通过平台托管运行路径交付，平台可计费、限流、保存任务记录，并在沙箱审计完成后展示可信证据。",
        en: "The Agent is delivered through the managed-runtime path, so AgentLens can meter, rate-limit, keep task records, and show trust evidence after sandbox audit."
      },
      dataRetentionPolicy: {
        zh: "用户原文属于私有运行记录；公开审计层只应保存 hash、摘要、资源和网络边界证据。",
        en: "User text belongs in private run records. Public audit should store only hashes, summaries, resource usage, and network-boundary evidence."
      }
    };
  }

  if (contractRuntime === "model-gateway") {
    return {
      custodyProtocol: "managed_gateway",
      vendorVerification: "verified_vendor",
      auditDisclosureMode: "run_trace",
      settlementMode: "managed_credit_internal",
      label: {
        zh: "平台网关运行 · 统一积分",
        en: "Platform gateway · unified credits"
      },
      description: {
        zh: "任务经 AgentLens 模型网关调用上游模型；平台负责统一积分、运行记录和失败状态，但这不等同于官方客户端完整体验。",
        en: "Tasks route through the AgentLens model gateway to an upstream model. AgentLens handles credits, run records, and failure states, but this is not the full official client experience."
      },
      dataRetentionPolicy: {
        zh: "平台需要保留私有会话记录用于恢复和退款；对外证明只应使用 hash、用量和 fundFlow 摘要。",
        en: "AgentLens may keep private session records for restore and refunds. External proof should use hashes, usage, and fundFlow summaries."
      }
    };
  }

  if (contractRuntime === "external-adapter" || contractRuntime === "seller-api" || access.has("api")) {
    return {
      custodyProtocol: "seller_api",
      vendorVerification: inferVendorVerification(entry),
      auditDisclosureMode: "black_box_evidence",
      settlementMode: "managed_credit_gateway_fee",
      label: {
        zh: "卖家托管 API · 平台代收费",
        en: "Seller-hosted API · platform-billed"
      },
      description: {
        zh: "Agent 运行在卖家或第三方 API，平台只通过网关触发、计费、限流和记录黑盒证据；不能展示平台沙箱审计。",
        en: "The Agent runs in a seller or third-party API. AgentLens triggers, bills, rate-limits, and records black-box evidence through the gateway, but cannot show platform sandbox audit."
      },
      dataRetentionPolicy: {
        zh: "用户输入会被转发到外部 API；平台必须最小化转发字段，并明确卖家数据责任。",
        en: "User input is forwarded to an external API. AgentLens must minimize forwarded fields and make seller data responsibility explicit."
      }
    };
  }

  return {
    custodyProtocol: "official_redirect",
    vendorVerification: inferVendorVerification(entry),
    auditDisclosureMode: "directory_only",
    settlementMode: "none",
    label: {
      zh: "跳转官方 · 平台不参与运行",
      en: "Official redirect · AgentLens does not run it"
    },
    description: {
      zh: "Agent 主要在官方产品侧运行，AgentLens 只做收录、比较、使用说明和跳转，不承诺平台计费、运行或审计。",
      en: "The Agent primarily runs in the official product. AgentLens lists, compares, explains, and redirects; it does not promise platform billing, runtime, or audit."
    },
    dataRetentionPolicy: {
      zh: "平台不接收真实任务输入；隐私和数据保留以官方产品条款为准。",
      en: "AgentLens does not receive real task input. Privacy and retention follow the official product terms."
    }
  };
}

export function isPlatformSandboxCandidate(entry: AgentCatalogEntry): boolean {
  return entry.source === "marketplace" && entry.id.startsWith("platform-");
}

function inferVendorVerification(entry: AgentCatalogEntry): AgentVendorVerification {
  if (entry.vendor === "AgentLens" || entry.id.startsWith("platform-")) {
    return "platform_owned";
  }
  const vendor = (entry.vendor ?? "").toLowerCase();
  if (
    vendor.includes("openai") ||
    vendor.includes("anthropic") ||
    vendor.includes("google") ||
    vendor.includes("dify") ||
    vendor.includes("n8n") ||
    vendor.includes("microsoft") ||
    vendor.includes("salesforce")
  ) {
    return "verified_vendor";
  }
  if (entry.source === "marketplace") {
    return "seller_verified";
  }
  return "unverified";
}

export function hasAuditEvidence(entry: AgentCatalogEntry): boolean {
  const chain = entry.chainEvidence;
  if (!chain) return false;
  return Boolean(
    chain.auditPassed ||
      isNonZeroHash(chain.reportHash) ||
      isNonZeroHash(chain.attestationHash)
  );
}

export function hasOnboarding(entry: AgentCatalogEntry): boolean {
  return entry.hasOnboardingGuide;
}

export function isRentable(entry: AgentCatalogEntry): boolean {
  return Boolean(entry.nativePricing?.rentable);
}

export function hasWorkspaceRunnableAdmission(entry: AgentCatalogEntry): boolean {
  const admission = entry.workspaceAdmission;
  if (!admission) return false;

  return admission.canOpenWorkspace === true &&
    admission.status === "workspace_runnable" &&
    (admission.packageGateStatus === undefined || admission.packageGateStatus === "workspace_runnable");
}

export function isHostedWorkspaceRunnableEntry(entry: AgentCatalogEntry): boolean {
  return entry.source === "marketplace" &&
    entry.id.startsWith("hst-") &&
    hasWorkspaceRunnableAdmission(entry);
}
