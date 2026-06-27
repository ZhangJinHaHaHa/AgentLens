import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "browser-use-readonly",
  prerequisites: [
    {
      zh: "AgentLens 需要先配置 Browser Use 只读托管适配器；未配置时卡片只展示为待接入。",
      en: "AgentLens needs a hosted Browser Use read-only adapter first; before that, the card remains pending."
    },
    {
      zh: "首版只适合公开网页采集，不适合需要登录、提交表单、上传文件或付款的任务。",
      en: "The first version fits public web collection, not tasks that require login, form submission, file upload, or payment."
    }
  ],
  firstStep: {
    zh: "在平台工作区打开网页信息采集，输入一个只读网页任务，例如“打开三个公开价格页，整理套餐差异和来源”。",
    en: "Open Web Info Collector in the workspace and enter a read-only web task, for example: “Open three public pricing pages and summarise plan differences with sources.”"
  },
  steps: [
    {
      title: { zh: "把任务限定在公开网页", en: "Keep the task on public webpages" },
      body: {
        zh: "尽量提供网址、关键词、要比较的字段和输出格式。不要要求它登录账号或提交任何内容。",
        en: "Provide URLs, keywords, comparison fields, and output format. Do not ask it to sign in or submit anything."
      }
    },
    {
      title: { zh: "检查来源和页面可访问性", en: "Review sources and page accessibility" },
      body: {
        zh: "结果返回后先看来源链接是否能打开、页面是否公开、摘要是否来自原页面。",
        en: "After results return, check whether source links open, pages are public, and summaries come from the original pages."
      }
    },
    {
      title: { zh: "把采集结果转成下一步清单", en: "Turn collection into next steps" },
      body: {
        zh: "继续追问“哪些页面证据最强”“哪些字段缺失”“下一步要人工核验什么”。",
        en: "Ask follow-ups like “Which pages have the strongest evidence?”, “Which fields are missing?”, and “What needs human verification next?”"
      }
    }
  ],
  officialDocs: [
    {
      label: { zh: "Browser Use GitHub", en: "Browser Use GitHub" },
      url: "https://github.com/browser-use/browser-use"
    },
    {
      label: { zh: "Browser Use 文档", en: "Browser Use docs" },
      url: "https://docs.browser-use.com"
    }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：把网页信息采集当作“只读网页跑腿”，不要让它代替你登录、下单或发布内容。平台会保留来源和运行记录，方便复核和结算。",
    en: "AgentLens advice: treat Web Info Collector as a read-only web runner. Do not use it to sign in, purchase, or publish content. AgentLens keeps sources and run records for review and settlement."
  },
  commonPitfalls: [
    {
      zh: "把“打开网页读内容”和“代替我操作账号”混在一个任务里；首版会直接拒绝后者。",
      en: "Mixing “read public pages” with “operate my account”; the first version rejects the latter."
    },
    {
      zh: "只说“帮我查竞品”，但没有给行业、地区、网址或要比较的字段，结果会变泛。",
      en: "Asking “check competitors” without industry, region, URLs, or comparison fields leads to vague results."
    }
  ]
};
