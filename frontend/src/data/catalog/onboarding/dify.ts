import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "dify",
  prerequisites: [
    { zh: "Docker 或 Docker Compose（自托管路线）；或直接用 dify.ai 云端版。", en: "Docker or Docker Compose for self-hosting, or use the dify.ai cloud." },
    { zh: "至少一个 LLM API Key（OpenAI / Anthropic / 本地模型均可）。", en: "At least one LLM API key — OpenAI, Anthropic, or a local model endpoint." },
    { zh: "确定你要搭建的第一个应用类型：聊天机器人、RAG 问答还是流程编排。", en: "Decide what you're building first: chatbot, RAG Q&A, or a workflow pipeline." }
  ],
  firstStep: {
    zh: "云端版：直接注册 dify.ai，30 分钟内可跑通第一个 RAG 聊天应用。自托管：克隆仓库后执行 docker compose up -d。",
    en: "Cloud: sign up at dify.ai — you can run your first RAG chatbot within 30 minutes. Self-hosted: clone the repo and run docker compose up -d."
  },
  steps: [
    {
      title: { zh: "连接大模型", en: "Connect a language model" },
      body: {
        zh: "进入 Settings → Model Provider，添加你的 API Key。Dify 支持 OpenAI、Anthropic、Gemini 和主流开源模型。",
        en: "Go to Settings → Model Provider and add your API key. Dify supports OpenAI, Anthropic, Gemini and major open-source models."
      }
    },
    {
      title: { zh: "搭第一个 RAG 知识库", en: "Build your first knowledge base" },
      body: {
        zh: "在 Knowledge 里上传 PDF / Markdown / 网页，选择分块策略，Dify 自动向量化，3 分钟内可以开始问答。",
        en: "In Knowledge, upload PDFs, Markdown or URLs. Dify auto-chunks and embeds them — start Q&A in 3 minutes."
      }
    },
    {
      title: { zh: "用 Workflow 编排多步任务", en: "Orchestrate multi-step tasks with Workflow" },
      body: {
        zh: "在 Studio → Workflow 用可视化拖拽构建 LLM 节点、工具调用、条件分支和循环，最终发布为 API。",
        en: "In Studio → Workflow, drag LLM nodes, tool calls, conditionals and loops visually, then publish as an API endpoint."
      }
    },
    {
      title: { zh: "对接外部系统", en: "Integrate with external systems" },
      body: {
        zh: "每个 Dify 应用都有标准 REST API，可以直接用 curl 或 SDK 接入现有产品，无需改造前端。",
        en: "Every Dify app exposes a standard REST API. Call it from curl or the SDK and integrate into your existing product without touching the frontend."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Dify 文档", en: "Dify docs" }, url: "https://docs.dify.ai" },
    { label: { zh: "自托管部署指南", en: "Self-hosting guide" }, url: "https://docs.dify.ai/getting-started/install-self-hosted" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：先从云端版验证流程可行性，再迁移到自托管；自托管时务必用 Secrets Manager 管理 API Key，不要硬编码在应用配置里。",
    en: "AgentLens advice: prototype on cloud first, then migrate to self-hosted once the workflow is validated. Use a secrets manager for API keys — never hardcode them in the app config."
  },
  commonPitfalls: [
    { zh: "知识库分块太大，导致 RAG 召回精度低。建议按语义段落而非固定字数分块。", en: "Chunks too large lead to poor RAG recall. Prefer semantic paragraph splits over fixed character counts." },
    { zh: "自托管后忘记升级 Dify 版本，错过重要 bug fix。", en: "Forgetting to upgrade the self-hosted version and missing important bug fixes." }
  ]
};
