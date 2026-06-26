import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "autogen-studio",
  prerequisites: [
    { zh: "Python/服务端运行环境和模型 API Key。", en: "A Python/server runtime and model API keys." },
    { zh: "一个明确的多 Agent 实验目标，而不是泛泛地“让它自动做事”。", en: "A clear multi-agent experiment goal, not a vague request to automate everything." },
    { zh: "日志、成本上限和工具权限策略。", en: "Logging, cost caps, and tool-permission strategy." }
  ],
  firstStep: {
    zh: "先做研究型 demo：一个 Agent 搜集公开资料，一个 Agent 复核，一个 Agent 输出摘要。",
    en: "Start with a research demo: one Agent gathers public material, one reviews, and one writes the summary."
  },
  steps: [
    {
      title: { zh: "确定实验边界", en: "Set experiment boundaries" },
      body: {
        zh: "AutoGen 适合技术验证。先限制任务类型、最大轮次和工具集合。",
        en: "AutoGen is suited to technical validation. Limit task type, max rounds, and tools first."
      }
    },
    {
      title: { zh: "记录每轮对话", en: "Log every round" },
      body: {
        zh: "多 Agent 对话必须保留每轮输入、输出和工具调用，否则出错很难追。",
        en: "Multi-agent conversations must keep every input, output, and tool call or failures are hard to trace."
      }
    },
    {
      title: { zh: "产品化前再包装", en: "Wrap before productizing" },
      body: {
        zh: "面向普通用户时，不展示框架细节，只展示任务入口、进度和交付物。",
        en: "For consumers, hide framework details and show only task entry, progress, and deliverables."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "AutoGen 仓库", en: "AutoGen repository" }, url: "https://github.com/microsoft/autogen" },
    { label: { zh: "AutoGen 文档", en: "AutoGen docs" }, url: "https://microsoft.github.io/autogen/" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：AutoGen 先放在技术型 Agent 货架，不作为普通用户第一入口；后续用它支撑复杂任务地图。",
    en: "AgentLens advice: keep AutoGen on the technical Agent shelf first, not as the first consumer entry; use it later to power complex-task maps."
  },
  commonPitfalls: [
    { zh: "没有产品包装，普通用户不知道该怎么用。", en: "Without product packaging, consumers do not know how to use it." },
    { zh: "循环对话没有上限，导致成本和延迟不可控。", en: "Unbounded conversation loops make cost and latency unpredictable." }
  ]
};
