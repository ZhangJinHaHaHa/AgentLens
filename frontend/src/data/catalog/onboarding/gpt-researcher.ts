import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "gpt-researcher",
  prerequisites: [
    {
      zh: "AgentLens 需要先配置数据侦查托管适配器；未配置时卡片只展示为待接入。",
      en: "AgentLens needs a hosted Data Scout adapter first; before that, the card remains pending."
    },
    {
      zh: "首版适合查公开政务、统计年鉴、预算决算和财政拨款数据，不适合登录、付费墙、私有数据库或自动提交申请表。",
      en: "The first version fits public government, yearbook, budget, final-account, and funding data; it does not log in, cross paywalls, access private databases, or submit request forms."
    }
  ],
  firstStep: {
    zh: "在平台工作区打开数据侦查员，输入一个具体找数问题，例如“帮我找 2023 年北京市体育局对体育场馆建设的财政拨款数据”。",
    en: "Open Data Scout in the workspace and enter a concrete data-finding question, for example: “Find 2023 Beijing Sports Bureau public funding data for sports venue construction.”"
  },
  steps: [
    {
      title: { zh: "把问题写成可找数任务", en: "Turn the request into a data-finding task" },
      body: {
        zh: "尽量说明地区、部门、年份、领域和你要的口径，比如“财政拨款”“部门决算”“统计年鉴”。问题越具体，官方来源检索越稳定。",
        en: "Specify region, department, year, field, and measurement such as funding, final account, or statistical yearbook. The more concrete the request, the steadier official-source retrieval becomes."
      }
    },
    {
      title: { zh: "先看数字和来源", en: "Review the number and source first" },
      body: {
        zh: "结果返回后先看是否有具体数字、是否来自 gov.cn、stats.gov.cn、地方政府或部门预算决算页面；不要只看摘要。",
        en: "After the result returns, first check whether it contains a concrete number and whether the source is gov.cn, stats.gov.cn, a local government site, or a department budget/final-account page."
      }
    },
    {
      title: { zh: "找不到就转核验路径", en: "Turn missing data into a verification path" },
      body: {
        zh: "如果公开页没有具体数字，让它列出已查过的官方入口和下一步建议，例如通过政府信息公开申请获取。",
        en: "If public pages do not contain a concrete number, ask it to list checked official entry points and next steps such as filing a public-information request."
      }
    }
  ],
  officialDocs: [
    {
      label: { zh: "GPT Researcher 参考项目", en: "GPT Researcher reference project" },
      url: "https://github.com/assafelovic/gpt-researcher"
    },
    {
      label: { zh: "GPT Researcher 参考文档", en: "GPT Researcher reference docs" },
      url: "https://docs.gptr.dev/docs/gpt-researcher/getting-started"
    }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：把数据侦查员当作“公开数据线索员”，不是最终统计口径审核者。平台会保留检索记录和积分记录，方便复核和结算。",
    en: "AgentLens advice: treat Data Scout as a sourced data-finding assistant, not the final judge. AgentLens keeps research records and credit records for review and settlement."
  },
  commonPitfalls: [
    {
      zh: "把模型综合后的结论当成一手证据；真正引用时仍要回到原始政府网页、统计年鉴或预算决算文件。",
      en: "Treating the synthesized answer as primary evidence; cite the original page or report when it matters."
    },
    {
      zh: "问题太宽，例如“帮我找北京体育数据”，会导致结果泛泛而谈；要给年份、部门和数据口径。",
      en: "Asking a broad question like “find Beijing sports data” produces vague results; provide year, department, and measurement."
    }
  ]
};
