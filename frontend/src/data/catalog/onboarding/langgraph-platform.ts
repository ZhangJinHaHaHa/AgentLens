import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * LangGraph 条目描述可恢复长流程的内部编排底座，来源是官方仓库与文档；面向详情页的输出强调
 * 状态图、持久化/回放和消费者工作区包装，而不是让买家直接操作状态机。
 * langgraph-platform 是平台型精选卡的持久标识，区别于具体 LangGraph 应用或运行实例，不能因
 * SDK 版本变更而迁移。步骤顺序体现“先定义状态契约，再实现恢复，最后包装界面”，是编号展示的一部分。
 * 本文件不持久化 checkpoint、不创建队列、不执行重试，也不授予工具或人工审批权限。
 * 节点输入输出不完整、恢复状态丢失或任务队列不可用时必须由运行层显式失败并保留回放证据；
 * 静态指南不得把一张状态图等同于已具备可靠的长任务能力。
 */
export const guide: OnboardingGuide = {
  agentId: "langgraph-platform",
  prerequisites: [
    { zh: "LangChain/LangGraph 服务环境和模型配置。", en: "A LangChain/LangGraph service environment and model configuration." },
    { zh: "明确状态节点：输入、工具、人工确认、失败、恢复和最终交付。", en: "Clear state nodes: input, tools, human approval, failure, resume, and final delivery." },
    { zh: "需要持久化存储和任务队列，不能只靠前端状态。", en: "Persistent storage and queues are required; frontend state alone is not enough." }
  ],
  firstStep: {
    zh: "先做一个可恢复的长流程 demo：资料输入、联网检索、人工确认、生成报告、保存日志。",
    en: "Start with a resumable long-flow demo: material input, web retrieval, human approval, report generation, and logs."
  },
  steps: [
    {
      title: { zh: "画出状态图", en: "Draw the state graph" },
      body: {
        zh: "把每个节点的输入、输出、失败条件和人工确认点写清楚，再写代码。",
        en: "Define each node's input, output, failure condition, and approval point before coding."
      }
    },
    {
      title: { zh: "加持久化和回放", en: "Add persistence and replay" },
      body: {
        zh: "长流程必须能暂停、恢复、重试和回放，否则手机端体验会不稳定。",
        en: "Long flows must pause, resume, retry, and replay or the mobile experience will be unstable."
      }
    },
    {
      title: { zh: "包装成主地图能力", en: "Wrap it as a main-map capability" },
      body: {
        zh: "普通用户看到的是“帮我完成任务”的工作区，不是状态机编辑器。",
        en: "Consumers should see a task workspace, not a state-machine editor."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "LangGraph 仓库", en: "LangGraph repository" }, url: "https://github.com/langchain-ai/langgraph" },
    { label: { zh: "LangGraph 文档", en: "LangGraph docs" }, url: "https://langchain-ai.github.io/langgraph/" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：LangGraph 是平台工作区主地图底座候选，不要直接卖框架；把它变成普通用户能用的任务流。",
    en: "AgentLens advice: LangGraph is a candidate base for the workspace main map. Do not sell the framework directly; turn it into usable task flows."
  },
  commonPitfalls: [
    { zh: "只做图，不做持久化和人工确认，长任务会断。", en: "A graph without persistence and approval will break long tasks." },
    { zh: "把复杂状态机界面暴露给普通用户。", en: "Exposing a complex state-machine UI to ordinary users." }
  ]
};
