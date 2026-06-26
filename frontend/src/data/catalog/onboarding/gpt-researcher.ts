import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "gpt-researcher",
  prerequisites: [
    {
      zh: "AgentLens 需要先配置 GPT Researcher 托管适配器；未配置时卡片只展示为待接入。",
      en: "AgentLens needs a hosted GPT Researcher adapter first; before that, the card remains pending."
    },
    {
      zh: "首版适合公开网页调研，不适合需要登录、付费墙或私有数据库的任务。",
      en: "The first version fits public web research, not login-only, paywalled, or private-database tasks."
    }
  ],
  firstStep: {
    zh: "在平台工作区打开 Deep Research，输入一个具体调研问题，例如“调研中国跨境电商卖家 2026 年最关心的三个 AI 工具场景，并给出来源”。",
    en: "Open Deep Research in the workspace and enter a concrete research question, for example: “Research the top three AI tool scenarios for Chinese cross-border e-commerce sellers in 2026 and cite sources.”"
  },
  steps: [
    {
      title: { zh: "把问题写成可调研任务", en: "Turn the request into a research task" },
      body: {
        zh: "尽量说明行业、地区、时间范围、输出格式和判断标准。问题越具体，搜索和来源筛选越稳定。",
        en: "Specify industry, region, time range, output format, and judging criteria. The more concrete the request, the steadier the search and source review."
      }
    },
    {
      title: { zh: "检查来源和不确定性", en: "Review sources and uncertainty" },
      body: {
        zh: "报告返回后先看引用来源、发布时间和是否有互相矛盾的信息；重要结论不要只看摘要。",
        en: "After the report returns, review cited sources, publication dates, and conflicting evidence. Do not rely only on the summary for important conclusions."
      }
    },
    {
      title: { zh: "用追问把报告变成行动项", en: "Use follow-ups to turn the report into actions" },
      body: {
        zh: "继续追问“哪些证据最强”“我应该优先做哪三件事”“哪些地方需要人工核验”，把调研结果转成下一步清单。",
        en: "Ask follow-ups like “Which evidence is strongest?”, “What are the top three actions?”, and “What needs human verification?” to turn research into next steps."
      }
    }
  ],
  officialDocs: [
    {
      label: { zh: "GPT Researcher GitHub", en: "GPT Researcher GitHub" },
      url: "https://github.com/assafelovic/gpt-researcher"
    },
    {
      label: { zh: "GPT Researcher 文档", en: "GPT Researcher docs" },
      url: "https://docs.gptr.dev/docs/gpt-researcher/getting-started"
    }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：把 Deep Research 当作“带来源的调研跑腿”，不是最终判断者。平台会保留调研 trace 和积分记录，方便复核和结算。",
    en: "AgentLens advice: treat Deep Research as a sourced research runner, not the final judge. AgentLens keeps research traces and credit records for review and settlement."
  },
  commonPitfalls: [
    {
      zh: "把模型综合后的结论当成一手证据；真正引用时仍要回到原始网页或报告。",
      en: "Treating the synthesized answer as primary evidence; cite the original page or report when it matters."
    },
    {
      zh: "问题太宽，例如“帮我调研 AI”，会导致报告泛泛而谈；要给范围和用途。",
      en: "Asking a broad question like “research AI” produces vague reports; define scope and use case."
    }
  ]
};
