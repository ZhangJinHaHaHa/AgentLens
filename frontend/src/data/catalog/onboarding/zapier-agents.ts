import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "zapier-agents",
  prerequisites: [
    { zh: "一个 Zapier 账号，以及你要连接的 SaaS 工具账号。", en: "A Zapier account and accounts for the SaaS tools you want to connect." },
    { zh: "明确 Agent 可以执行哪些动作：创建任务、发邮件、写表格、同步 CRM 等。", en: "Define what actions the agent may perform: create tasks, send emails, write rows, sync CRM, and so on." },
    { zh: "准备一个沙盒账户或测试数据集，先不要连生产 CRM/财务系统。", en: "Prepare a sandbox account or test dataset before connecting production CRM or finance systems." }
  ],
  firstStep: {
    zh: "先选一个低风险流程，例如“把表单线索整理成 CRM 草稿”，让 Zapier Agent 只生成草稿，不自动发送或提交。",
    en: "Start with a low-risk workflow, such as turning form leads into CRM drafts. Let the Zapier Agent draft only, not send or submit automatically."
  },
  steps: [
    {
      title: { zh: "定义允许动作", en: "Define allowed actions" },
      body: {
        zh: "把 Agent 权限限制在少数工具和动作上，例如只读 Gmail、写入测试表格、创建草稿任务。",
        en: "Limit permissions to a small set of tools and actions, such as read-only Gmail, writing to a test sheet, or creating draft tasks."
      }
    },
    {
      title: { zh: "用真实样例做 dry run", en: "Run realistic dry runs" },
      body: {
        zh: "用 10 条低敏感真实样例测试它是否理解字段、是否触发错误动作、是否需要人工确认。",
        en: "Test with ten realistic low-sensitivity samples to check field understanding, wrong actions and whether human confirmation is needed."
      }
    },
    {
      title: { zh: "上线前加审批点", en: "Add approval before launch" },
      body: {
        zh: "凡是会发给客户、改 CRM、扣款或通知团队的动作，都先放到人工审批后执行。",
        en: "Any action that contacts customers, changes CRM, charges money or notifies a team should require approval first."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Zapier Agents 首页", en: "Zapier Agents home" }, url: "https://zapier.com/agents" },
    { label: { zh: "Zapier 帮助中心", en: "Zapier help center" }, url: "https://help.zapier.com" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：Zapier Agents 适合业务自动化，不适合一上来处理高敏感或不可逆动作。先让它做草稿和整理，再逐步开放写入权限。",
    en: "AgentLens advice: Zapier Agents fit business automation, not high-sensitivity or irreversible actions on day one. Start with drafts and organization, then gradually allow writes."
  },
  commonPitfalls: [
    { zh: "一开始就连接生产账号并允许自动发送邮件。", en: "Connecting production accounts and allowing automatic email sends from the start." },
    { zh: "没有给失败、重复触发、字段缺失设计兜底流程。", en: "No fallback flow for failures, duplicate triggers or missing fields." }
  ]
};
