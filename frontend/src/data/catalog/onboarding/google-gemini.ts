import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * Gemini 文件刻意区分消费者网页助手与开发者 API 两条入口，资料来自 Gemini Web 与官方 API 文档，
 * 输出给详情页的是先低敏试用、再多模态抽样、最后用结构化 schema 接产品的评估路径。
 * google-gemini 是目录稳定键，不跟随具体模型代次、AI Studio 品牌或 Cloud 项目名称迁移；
 * 步骤顺序和中英文本共同构成展示兼容面，消费者不得自行把 API 步骤提升到网页试用之前。
 * 静态指南不创建 Cloud 项目、不签发 Key、不读取 Workspace 数据，也不验证图片业务判断的正确性。
 * 权限治理不足、关键字段识别失败或输出不符合 schema 时应由接入层拒绝/降级；官方能力和链接
 * 随时间变化属于需人工复核的时效风险，不能在这里按模型名猜测可用功能。
 */
export const guide: OnboardingGuide = {
  agentId: "google-gemini",
  prerequisites: [
    { zh: "普通使用只需要 Google 账号；API 集成需要 Google AI Studio 或 Google Cloud 项目。", en: "A Google account is enough for consumer use; API integration needs Google AI Studio or a Google Cloud project." },
    { zh: "如果接企业数据，先确认 Workspace/Cloud 权限和数据治理边界。", en: "For enterprise data, confirm Workspace/Cloud permissions and data governance first." },
    { zh: "准备 3 类测试问题：文本总结、图片理解、联网或资料问答。", en: "Prepare three test prompts: text summarization, image understanding, and web/document Q&A." }
  ],
  firstStep: {
    zh: "普通用户先打开 gemini.google.com，用一个真实但低敏感的工作问题测试；开发者再去 AI Studio 生成 API Key。",
    en: "Consumers should start at gemini.google.com with a realistic low-sensitivity work question; developers can then create an API key in AI Studio."
  },
  steps: [
    {
      title: { zh: "区分网页助手和 API", en: "Separate web assistant from API use" },
      body: {
        zh: "网页端适合个人问答、图片理解和草稿；API 适合接入产品、批处理或自动化流程。",
        en: "The web app is best for personal Q&A, image understanding and drafts. The API is for products, batch jobs and automated workflows."
      }
    },
    {
      title: { zh: "先测多模态", en: "Test multimodal tasks early" },
      body: {
        zh: "如果你的需求包含截图、表格、图片或 PDF，先用 5 个样例测试它是否真能读懂关键字段。",
        en: "If your task includes screenshots, tables, images or PDFs, test five samples first and check whether key fields are understood."
      }
    },
    {
      title: { zh: "给 API 加输出结构", en: "Constrain API output" },
      body: {
        zh: "开发接入时不要只让模型自由回答；要求 JSON 字段、置信度、引用来源和失败原因。",
        en: "For API integration, avoid free-form answers. Request JSON fields, confidence, sources and failure reasons."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Gemini 网页端", en: "Gemini web app" }, url: "https://gemini.google.com" },
    { label: { zh: "Gemini API 文档", en: "Gemini API docs" }, url: "https://ai.google.dev/gemini-api/docs" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：Gemini 适合 Google 生态和多模态任务；如果你的核心数据在 Microsoft 365、Notion 或私有数据库里，先确认连接器和权限治理是否成熟。",
    en: "AgentLens advice: Gemini is strong for Google ecosystem and multimodal tasks. If your data lives in Microsoft 365, Notion or private databases, verify connector maturity and permission controls first."
  },
  commonPitfalls: [
    { zh: "把“能读图”误认为“能可靠做业务判断”，关键字段仍要抽样复核。", en: "Treating image understanding as reliable business judgment. Sample-check key fields." },
    { zh: "API 调用没有固定输出 schema，导致下游流程难以解析。", en: "Calling the API without a stable output schema, making downstream automation brittle." }
  ]
};
