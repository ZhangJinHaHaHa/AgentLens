import type { ScenarioRef } from "@/domain/catalog";
import type { I18nText } from "@/domain/i18nText";

/*
 * map 是目录场景的规范词表：键来自编辑定义，双语标签输出给筛选器、列表详情和每个 Agent 的
 * scenarios/unsuitableScenarios 引用。键还进入 URL 筛选参数与任务分类规则，因而是持久标识，
 * 不能随展示措辞改名；改标签只影响呈现，改键则需要迁移书签、查询参数和所有目录引用。
 * Object.keys 保留此处声明顺序，所以新增位置会改变筛选项的展示顺序；不要在消费者里另建排序表。
 * 本注册表不判断适配度、权限或运行能力，也不负责把相近场景自动归并。scenario 对未知键立即抛错，
 * 让拼写和漏注册在加载/构建阶段暴露；直接以不受控字符串读取 SCENARIO_MAP 时，调用方仍须接受
 * undefined，不能把缺失标签误当成已支持场景。
 */
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
  "security-audit": { zh: "代码安全审计", en: "Code security audit" },
  "public-opinion": { zh: "舆情分析", en: "Public-opinion analysis" },
  "prediction-simulation": { zh: "趋势预测与模拟", en: "Prediction & simulation" },
  "browser-automation": { zh: "浏览器自动化", en: "Browser automation" },
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
