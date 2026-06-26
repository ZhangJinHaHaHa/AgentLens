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
