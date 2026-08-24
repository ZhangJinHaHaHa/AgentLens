import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * CrewAI 文件解释的是平台内部多角色编排底座如何从只读实验起步，资料来自 CrewAI 官网与文档，
 * 最终输出给买家的仍应是报告/审计等产品化入口，而不是原始 Crew 配置界面。
 * crewai-platform 这个稳定 id 特意区分“框架接入卡”与任意卖家 Agent；改成 crewai 会破坏精选条目、
 * 指南注册和已有详情链接。步骤次序固定为角色/交付物、工具/轮次、产品包装，体现由内向外的兼容路径。
 * 此处不实例化 Crew、不调模型、不执行工具，也不强制停止条件或成本上限；这些属于运行编排层。
 * 角色输出缺失、循环不收敛或权限白名单不可用时应让任务明确失败并保留日志，不能靠静态指南
 * 假定多 Agent 已达成共识或给普通用户展示虚假的完成状态。
 */
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
