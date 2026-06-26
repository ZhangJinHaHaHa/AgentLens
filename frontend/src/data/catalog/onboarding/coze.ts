import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "coze",
  prerequisites: [
    { zh: "一个 Coze 账号，或后续自托管 Coze Studio 的部署环境。", en: "A Coze account, or a later self-hosted Coze Studio environment." },
    { zh: "准备第一个 Bot 的知识库、欢迎语、渠道和允许调用的工具。", en: "Prepare the first bot's knowledge base, welcome message, channel, and allowed tools." },
    { zh: "如果接平台工作区，插件和用户资料读取必须有权限提示。", en: "If connected to AgentLens, plugin calls and profile reads need permission prompts." }
  ],
  firstStep: {
    zh: "先做一个只回答公开资料的测试 Bot，验证知识库召回和回答边界，再考虑接真实渠道。",
    en: "Build a test bot over public material first, verify retrieval and boundaries, then connect real channels."
  },
  steps: [
    {
      title: { zh: "创建测试 Bot", en: "Create a test bot" },
      body: {
        zh: "先不要接生产渠道，只放公开 FAQ 或产品说明，观察它是否会编造信息。",
        en: "Do not connect production channels first. Use public FAQs or product docs and watch for hallucination."
      }
    },
    {
      title: { zh: "配置知识库和工作流", en: "Configure knowledge and workflow" },
      body: {
        zh: "把常见问题、工具动作和人工转接条件放进工作流，避免 Bot 在高风险问题上硬答。",
        en: "Put FAQs, tool actions, and human-handoff rules into the workflow so the bot does not force high-risk answers."
      }
    },
    {
      title: { zh: "再接多端发布", en: "Then connect channels" },
      body: {
        zh: "接公众号、网页或客服入口前，先确认日志、隐私说明和人工接管都可用。",
        en: "Before publishing to web or support channels, confirm logs, privacy copy, and human takeover."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Coze 首页", en: "Coze home" }, url: "https://www.coze.com" },
    { label: { zh: "Coze Studio 开源仓库", en: "Coze Studio repository" }, url: "https://github.com/coze-dev/coze-studio" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：Coze 适合作为 Bot/知识库地图，不要把官方账号里的 Bot 权限默认搬到平台；先从测试 Bot 和只读问答接起。",
    en: "AgentLens advice: Coze fits the bot/knowledge map. Do not assume official-account bot permissions transfer to AgentLens; start with test bots and read-only Q&A."
  },
  commonPitfalls: [
    { zh: "一开始就接生产渠道，用户隐私和错误回复风险都很高。", en: "Connecting production channels immediately creates privacy and wrong-answer risk." },
    { zh: "插件权限没有说明清楚，用户不知道 Bot 会调用哪些外部工具。", en: "Plugin permissions are unclear, so users do not know which external tools the bot may call." }
  ]
};
