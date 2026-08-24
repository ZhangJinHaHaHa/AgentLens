/**
 * 为工作区路由提供确定性的粗粒度任务分类：先按稳定场景 ID 判定，再看目录关键词，最后以产品类型兜底，返回五种受限类别之一。
 * 场景判定的优先级是代码、自动化、文档、研究；同一条目命中多个集合时，顺序本身就是必须保持的业务不变量。
 * 该模块是纯计算，不写状态、不缓存、不联网；未知或信息不足的输入安全降级为 `other`，不会抛错或自动重试。
 * 名称、标签和分类文本可能来自编辑或卖家，只能用于界面分组，不能作为授予仓库、浏览器或外部账户权限的依据。
 * 正则和场景集合承担旧目录 ID 的兼容兜底，扩展词表时应避免让宽泛关键词抢在更明确的场景规则之前。
 */
import type { AgentCatalogEntry } from "./catalog";
import { getAgentProductType } from "./catalog";

export type AgentTaskCategory = "code_debug" | "research" | "document" | "automation" | "other";

const CODE_SCENARIOS = new Set([
  "developer-assistant",
  "devops-sre",
  "ide-coding",
  "agentic-coding",
  "ui-prototyping",
  "fullstack-prototyping",
  "security-audit"
]);

const RESEARCH_SCENARIOS = new Set([
  "market-research",
  "knowledge-qa",
  "data-analysis",
  "public-opinion",
  "prediction-simulation"
]);

const DOCUMENT_SCENARIOS = new Set([
  "content-generation",
  "content-ops",
  "legal-defense",
  "tax-planning",
  "ip-patent",
  "study-abroad",
  "construction-review"
]);

const AUTOMATION_SCENARIOS = new Set([
  "workflow-automation",
  "browser-automation",
  "customer-support",
  "ecom-sourcing",
  "insurance-claim",
  "exec-recruiting"
]);

const DOCUMENT_KEYWORDS = /\b(doc|docs|document|pdf|file|meeting|note|notion|notebook|slide|ppt|gamma|canva|contract)\b/i;
const RESEARCH_KEYWORDS = /\b(research|search|perplexity|glean|knowledge|browser-use-readonly|gpt-researcher)\b/i;
const AUTOMATION_KEYWORDS = /\b(workflow|automation|agentforce|zapier|n8n|make|gumloop|lindy|browser-use|coze|dify|langgraph|crewai|autogen)\b/i;

export function getAgentTaskCategory(entry: AgentCatalogEntry): AgentTaskCategory {
  const scenarioIds = new Set(entry.scenarios.map((scenario) => scenario.id));
  if (hasAnyScenario(scenarioIds, CODE_SCENARIOS)) return "code_debug";
  if (hasAnyScenario(scenarioIds, AUTOMATION_SCENARIOS)) return "automation";
  if (hasAnyScenario(scenarioIds, DOCUMENT_SCENARIOS)) return "document";
  if (hasAnyScenario(scenarioIds, RESEARCH_SCENARIOS)) return "research";

  const searchable = [
    entry.id,
    entry.name,
    entry.category,
    ...entry.tags
  ].join(" ");

  if (DOCUMENT_KEYWORDS.test(searchable)) return "document";
  if (AUTOMATION_KEYWORDS.test(searchable)) return "automation";
  if (RESEARCH_KEYWORDS.test(searchable)) return "research";

  const productType = getAgentProductType(entry);
  if (productType === "coding_agent") return "code_debug";
  if (productType === "workflow_agent" || productType === "agent_platform") return "automation";
  if (productType === "large_model_assistant") return "research";

  return "other";
}

function hasAnyScenario(scenarioIds: Set<string>, candidates: Set<string>): boolean {
  for (const candidate of candidates) {
    if (scenarioIds.has(candidate)) return true;
  }
  return false;
}
