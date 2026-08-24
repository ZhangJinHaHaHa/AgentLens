import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * Zapier Agents 指南针对跨 SaaS 的业务自动化，依据官方 Agents 与帮助中心资料，输出遵循
 * 最小动作集合、低敏 dry run、生产前审批的权限升级路径，而不是直接连接客户系统。
 * zapier-agents 是目录、指南注册与产品类型映射共享的稳定键，不随某个 Zap、连接器或套餐变更。
 * steps 的声明顺序会直接成为详情页编号，保证草稿/测试先于发送、CRM 修改和扣款；双语风险项同样
 * 需要保持语义一致。这里不发起 OAuth、不保存 SaaS 凭证、不触发 Zap，也不执行任何外部写入。
 * 重复触发、字段缺失、连接器失败、配额不足或审批拒绝时应进入真实工作流的兜底/失败分支；
 * 指南可见绝不代表生产账号已授权，更不能作为不可逆动作的默认同意。
 */
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
