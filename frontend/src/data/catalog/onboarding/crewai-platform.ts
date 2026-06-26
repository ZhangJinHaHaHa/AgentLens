import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "crewai-platform",
  prerequisites: [
    { zh: "Python 服务环境和可用模型 Key。", en: "A Python service environment and available model keys." },
    { zh: "把任务拆成角色、目标、工具和最终交付物。", en: "Split the job into roles, goals, tools, and final deliverables." },
    { zh: "准备工具权限白名单和成本上限。", en: "Prepare tool allowlists and cost limits." }
  ],
  firstStep: {
    zh: "先搭一个三角色测试 Crew：调研、整理、复核，只使用公开资料和只读工具。",
    en: "Start with a three-role test crew: research, organize, and review, using public material and read-only tools."
  },
  steps: [
    {
      title: { zh: "定义角色和交付物", en: "Define roles and deliverables" },
      body: {
        zh: "不要让每个 Agent 都做所有事。每个角色只负责一件清楚的工作。",
        en: "Do not let every Agent do everything. Give each role one clear responsibility."
      }
    },
    {
      title: { zh: "限制工具和轮次", en: "Limit tools and rounds" },
      body: {
        zh: "给每个角色设置最大轮次、工具白名单和失败退出条件。",
        en: "Set max rounds, tool allowlists, and failure exits for each role."
      }
    },
    {
      title: { zh: "包装成平台应用", en: "Wrap it as a platform app" },
      body: {
        zh: "普通用户不应该看到 Crew 配置，而是看到“调研报告”“审计流程”等产品化入口。",
        en: "Consumers should not see raw crew configuration; show productized entries such as research reports or audit flows."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "CrewAI 首页", en: "CrewAI home" }, url: "https://www.crewai.com" },
    { label: { zh: "CrewAI 文档", en: "CrewAI docs" }, url: "https://docs.crewai.com" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：CrewAI 更适合作为平台工作区 Agent 的内部编排底座，而不是直接暴露给普通买家配置。",
    en: "AgentLens advice: CrewAI is better as an internal orchestration base for workspace Agents than a raw consumer configuration UI."
  },
  commonPitfalls: [
    { zh: "多 Agent 没有停止条件，成本和输出都会失控。", en: "Multi-agent runs without stop conditions can lose cost and output control." },
    { zh: "把框架当成成品卖，普通用户会看不懂。", en: "Selling the framework itself confuses non-technical users." }
  ]
};
