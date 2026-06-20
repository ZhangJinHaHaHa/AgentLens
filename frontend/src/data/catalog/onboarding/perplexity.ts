import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "perplexity",
  prerequisites: [
    { zh: "浏览器或移动端即可上手，无需开发环境。", en: "Any browser or mobile device — no dev setup needed." },
    { zh: "如需 API 集成，准备好 Perplexity API Key。", en: "For API integration, have your Perplexity API key ready." }
  ],
  firstStep: {
    zh: "访问 perplexity.ai，直接在搜索框输入你的调研问题。它会实时联网检索并附带来源链接。",
    en: "Go to perplexity.ai and type your research question in the search box. It retrieves live sources and cites them inline."
  },
  steps: [
    {
      title: { zh: "理解 Spaces（集中话题调研）", en: "Use Spaces for focused research" },
      body: {
        zh: "创建一个 Space 可以把多轮对话、上传的 PDF 和网页引用收归一处，适合需要持续跟踪的调研课题。",
        en: "Create a Space to keep multi-turn chats, uploaded PDFs and web references together — ideal for ongoing research topics."
      }
    },
    {
      title: { zh: "选择搜索模式", en: "Pick the right search mode" },
      body: {
        zh: "默认 Web 模式适合大多数调研；Academic 模式专注同行评审论文；Writing 模式适合生成带引用的长文。",
        en: "Default Web mode covers most queries. Academic mode focuses on peer-reviewed papers. Writing mode generates long-form content with inline citations."
      }
    },
    {
      title: { zh: "用 API 嵌入你的工作流", en: "Embed in your workflow with the API" },
      body: {
        zh: "Perplexity 提供 OpenAI 兼容的 API，可以直接替换现有的 openai.chat.completions 调用，并让 LLM 获得实时联网能力。",
        en: "Perplexity exposes an OpenAI-compatible API — drop it in where you already call openai.chat.completions to give your LLM live web access."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Perplexity 帮助文档", en: "Perplexity help center" }, url: "https://www.perplexity.ai/hub/faq" },
    { label: { zh: "API 文档", en: "API docs" }, url: "https://docs.perplexity.ai" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：用 Perplexity 做初步行业调研，把它返回的引用来源链接单独存档，方便后续引用核查。重要决策的核心数据仍需人工验证一手来源。",
    en: "AgentLens advice: use Perplexity for initial industry scans and archive the cited source URLs separately for later fact-checking. For critical decisions, verify primary sources manually."
  },
  commonPitfalls: [
    { zh: "把 Perplexity 的答案当作一手来源直接引用，实际上它是二次综合。", en: "Citing Perplexity answers as primary sources — they are synthesised summaries, not first-hand data." },
    { zh: "忽略时效性：有些检索结果仍是旧版本，需注意发布日期。", en: "Missing the publication date — some results index older versions of pages." }
  ]
};
