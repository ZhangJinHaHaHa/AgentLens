import type { ScenarioRef } from "@/domain/catalog";
import type { I18nText } from "@/domain/i18nText";

const map: Record<string, I18nText> = {
  "defi-trading": { zh: "DeFi 交易", en: "DeFi trading" },
  "customer-support": { zh: "客服自动化", en: "Customer support automation" },
  "devops-sre": { zh: "服务器运维", en: "Server ops" },
  "data-analysis": { zh: "数据分析", en: "Data analysis" },
  "developer-assistant": { zh: "写代码助手", en: "Coding helper" },
  "workflow-automation": { zh: "流程自动化", en: "Workflow automation" },
  "content-generation": { zh: "写文案做图", en: "Writing & images" },
  "market-research": { zh: "市场调研", en: "Market research" },
  "ide-coding": { zh: "在编辑器里写代码", en: "Coding in your editor" },
  "agentic-coding": { zh: "AI 自动写代码", en: "AI writes code itself" },
  "ui-prototyping": { zh: "做界面原型", en: "UI mockups" },
  "fullstack-prototyping": { zh: "搭网站应用原型", en: "App prototypes" },
  "knowledge-qa": { zh: "查资料问答", en: "Q&A over your docs" },
  "multimodal-chat": { zh: "图文语音对话", en: "Text, image & voice chat" },
  // Expert-seller (marketplace) professional domains — each backed by a
  // seller's private accumulated context rather than a generic model.
  "legal-defense": { zh: "刑事辩护", en: "Criminal defense" },
  "tax-planning": { zh: "税务筹划", en: "Tax planning" },
  "ip-patent": { zh: "专利与知产", en: "Patent & IP" },
  "venture-dd": { zh: "投资尽调", en: "Investment due diligence" },
  "ecom-sourcing": { zh: "电商选品", en: "E-commerce sourcing" },
  "content-ops": { zh: "内容操盘", en: "Content operations" },
  "insurance-claim": { zh: "保险理赔", en: "Insurance claims" },
  "construction-review": { zh: "工程报建审图", en: "Construction plan review" },
  "exec-recruiting": { zh: "高端猎头", en: "Executive recruiting" },
  "study-abroad": { zh: "留学申请", en: "Study-abroad applications" }
};

export function scenario(id: keyof typeof map): ScenarioRef {
  const label = map[id];
  if (!label) {
    throw new Error(`Unknown scenario id: ${id}`);
  }
  return { id, label };
}

export const SCENARIO_IDS = Object.keys(map) as Array<keyof typeof map>;
export const SCENARIO_MAP = map;
