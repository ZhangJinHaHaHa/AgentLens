/**
 * 自然语言需求解析客户端：可向配置的 `/api/llm/parse-need` 发送 query、locale 与有限 taxonomy，并将响应交给领域白名单解析器。
 * 未配置服务、HTTP/JSON/协议异常、解析失败、网络错误或超时都会确定性降级到本地关键词规则；当前公开契约因此始终返回 `ok: true` 的结果。
 * 远端路径会产生一次 POST 和可选 AbortController 定时器，finally 清理计时器；不缓存、不额外重试，非正 timeout 表示不启用客户端超时。
 * 用户原文会越过浏览器/服务端隐私边界，调用方不得附带未获授权的敏感材料；模型响应不可信，场景、标签和枚举必须被 taxonomy 收敛。
 * 本地结果只给出有限同义词匹配和保守置信度，不应伪装为模型成功，也不能用作工作区授权或审计判断；离线回退是可用性兼容不变量。
 */
import {
  parseNeedParserResponse,
  type NeedParseResult,
  type NeedParserTaxonomy
} from "@/domain/needParser";

export interface NeedParserClientInput {
  query: string;
  locale: "zh" | "en";
  taxonomy: NeedParserTaxonomy;
  apiBaseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export type NeedParserClientResult =
  | {
      ok: true;
      result: NeedParseResult;
    }
  | {
      ok: false;
      error: string;
    };

const NEED_PARSER_TIMEOUT_MS = 10_000;

export async function parseNeedWithLlm(input: NeedParserClientInput): Promise<NeedParserClientResult> {
  const apiBaseUrl = input.apiBaseUrl?.replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return {
      ok: true,
      result: parseNeedLocally(input)
    };
  }

  const timeoutMs = input.timeoutMs ?? NEED_PARSER_TIMEOUT_MS;
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = timeoutMs > 0 ? new AbortController() : undefined;
  const timeout = controller
    ? globalThis.setTimeout(() => controller.abort(), timeoutMs)
    : undefined;

  try {
    const response = await fetchImpl(`${apiBaseUrl}/api/llm/parse-need`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(controller ? { signal: controller.signal } : {}),
      body: JSON.stringify({
        query: input.query,
        locale: input.locale,
        taxonomy: input.taxonomy
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok !== true) {
      return {
        ok: true,
        result: parseNeedLocally(input)
      };
    }

    return {
      ok: true,
      result: parseNeedParserResponse(JSON.stringify(body.result), input.taxonomy)
    };
  } catch (error) {
    return {
      ok: true,
      result: parseNeedLocally(input)
    };
  } finally {
    if (timeout !== undefined) {
      globalThis.clearTimeout(timeout);
    }
  }
}

function parseNeedLocally(input: NeedParserClientInput): NeedParseResult {
  const normalized = input.query.trim().toLowerCase();
  const scenarioIds = pickAllowed(input.taxonomy.scenarioIds, [
    [["客服", "客户", "工单", "售后", "support", "ticket", "helpdesk"], "customer-support"],
    [["知识库", "问答", "文档", "引用", "knowledge", "docs", "rag", "qa"], "knowledge-qa"],
    [["研发", "代码", "编程", "coding", "developer", "ide"], "developer-assistant"],
    [["运维", "监控", "告警", "devops", "sre", "incident"], "devops-sre"],
    [["数据", "分析", "报表", "sql", "dashboard", "analysis"], "data-analysis"],
    [["自动化", "流程", "workflow", "automation"], "workflow-automation"],
    [["内容", "写作", "图片", "视频", "content", "copy", "image", "video"], "content-generation"],
    [["调研", "搜索", "竞品", "research", "market"], "market-research"]
  ], normalized);
  const accessTypes = pickAllowed(input.taxonomy.accessTypes, [
    [["api", "sdk", "接口"], "api"],
    [["网页", "web", "saas"], "saas"],
    [["本地", "自托管", "local", "self-host"], "local"],
    [["命令行", "终端", "cli"], "cli"]
  ], normalized);
  const riskLevels = /低风险|安全|safe|low risk/.test(normalized) && input.taxonomy.riskLevels.includes("low")
    ? ["low" as const]
    : [];
  const complexities = /简单|快速|容易|simple|easy|fast/.test(normalized) && input.taxonomy.complexities.includes("low")
    ? ["low" as const]
    : [];

  return {
    scenarioIds,
    tags: input.taxonomy.tags.filter((tag) => normalized.includes(tag.toLowerCase())).slice(0, 6),
    accessTypes,
    riskLevels,
    complexities,
    hasAudit: /审计|可信|验证|audit|verified|attestation/.test(normalized),
    hasOnboarding: /上手|教程|指南|guide|tutorial|onboarding/.test(normalized),
    confidence: scenarioIds.length > 0 || accessTypes.length > 0 ? 0.55 : 0.25,
    unmatchedTerms: []
  };
}

function pickAllowed<T extends string>(
  allowed: readonly T[],
  rules: Array<[keywords: string[], value: T]>,
  normalizedQuery: string
): T[] {
  return rules
    .filter(([keywords, value]) => allowed.includes(value) && keywords.some((keyword) => normalizedQuery.includes(keyword)))
    .map(([, value]) => value);
}
