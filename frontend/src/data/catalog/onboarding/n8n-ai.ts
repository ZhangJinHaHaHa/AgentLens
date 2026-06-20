import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "n8n-ai",
  prerequisites: [
    { zh: "可直接用 n8n Cloud；自托管需要 Docker/服务器和基础运维能力。", en: "Use n8n Cloud directly, or self-host with Docker/server operations skills." },
    { zh: "至少一个模型 API Key，以及要接入的工具凭证。", en: "At least one model API key plus credentials for tools you want to connect." },
    { zh: "画清楚第一个 workflow：触发器、AI 节点、工具动作、失败通知。", en: "Sketch the first workflow: trigger, AI node, tool action and failure notification." }
  ],
  firstStep: {
    zh: "先用 n8n Cloud 或本地 Docker 跑一个只读 workflow：定时读取一条测试数据，让 AI 节点总结后写入测试表格。",
    en: "Start on n8n Cloud or local Docker with a read-only workflow: read one test item on a schedule, summarize it with an AI node and write to a test sheet."
  },
  steps: [
    {
      title: { zh: "先跑最小 workflow", en: "Run a minimal workflow first" },
      body: {
        zh: "不要一开始就搭复杂 Agent。用 trigger → AI → output 三步确认模型、凭证和日志都正常。",
        en: "Do not start with a complex agent. Use trigger → AI → output to verify model access, credentials and logs."
      }
    },
    {
      title: { zh: "限制工具权限", en: "Constrain tool permissions" },
      body: {
        zh: "给 API credential 做最小权限，例如只读邮箱、只写测试表、只能访问测试频道。",
        en: "Use least-privilege credentials, such as read-only mail, write-only test sheets and test-only channels."
      }
    },
    {
      title: { zh: "加错误分支和人工复核", en: "Add error paths and review" },
      body: {
        zh: "n8n 的优势是流程可视化。给失败、超时、模型低置信度和外部动作都加分支。",
        en: "n8n's strength is visual flow control. Add branches for failures, timeouts, low confidence and external actions."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "n8n 首页", en: "n8n home" }, url: "https://n8n.io" },
    { label: { zh: "n8n AI 文档", en: "n8n AI docs" }, url: "https://docs.n8n.io/advanced-ai/" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：n8n AI 适合想掌控部署和流程的团队。普通用户可以先用 Cloud；只有当你需要私有网络、内网工具或强审计时再自托管。",
    en: "AgentLens advice: n8n AI fits teams that want control over deployment and workflow logic. Start with Cloud; self-host only when you need private networks, internal tools or stronger auditability."
  },
  commonPitfalls: [
    { zh: "自托管后没有备份 workflow、credential 和数据库。", en: "Self-hosting without backing up workflows, credentials and the database." },
    { zh: "把模型输出直接当作动作参数，缺少校验和人工确认。", en: "Using model output directly as action parameters without validation or confirmation." }
  ]
};
