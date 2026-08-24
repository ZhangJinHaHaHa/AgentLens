import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * Microsoft Copilot 指南聚焦 Microsoft 365 租户内的办公知识使用，依据官方产品与支持资料，
 * 输出顺序把权限治理放在文档总结、邮件草稿等高频低风险试用之前，并最终要求人工复核。
 * microsoft-copilot 是目录长期 id，不随授权 SKU、Teams 入口或具体模型版本变化；指南 Map 和详情
 * 路由均依赖它。数组次序属于安全展示契约，不能因 UI 紧凑而省略或重排权限审计。
 * 本文件不读取 SharePoint/OneDrive/Teams、不分配许可证、不修复过度共享，也不自动发送办公内容。
 * 租户授权不足、引用不准确或资料越权时应由 Microsoft 控制面和组织策略阻止；静态指南可见
 * 绝不意味着平台获得了企业数据访问权。
 */
export const guide: OnboardingGuide = {
  agentId: "microsoft-copilot",
  prerequisites: [
    { zh: "Microsoft 账号；企业场景通常需要 Microsoft 365 租户和相应 Copilot 授权。", en: "A Microsoft account; enterprise use usually needs a Microsoft 365 tenant and the right Copilot license." },
    { zh: "先清理 SharePoint、OneDrive、Teams 里的过度共享文件。", en: "Clean up over-shared files in SharePoint, OneDrive and Teams before rollout." },
    { zh: "准备一组低敏感办公样例：邮件总结、会议纪要、文档草稿、表格解释。", en: "Prepare low-sensitivity office samples: email summaries, meeting notes, document drafts and spreadsheet explanations." }
  ],
  firstStep: {
    zh: "先在 Microsoft 365 网页端或 Teams 里让 Copilot 总结一份低敏感文档，观察它能访问哪些资料、引用是否准确。",
    en: "Start in Microsoft 365 web or Teams by asking Copilot to summarize a low-sensitivity document, then inspect what it can access and whether citations are accurate."
  },
  steps: [
    {
      title: { zh: "先治理权限", en: "Govern permissions first" },
      body: {
        zh: "Copilot 的价值来自组织知识，但风险也来自组织知识。上线前先做权限审计，尤其是全员可读目录。",
        en: "Copilot's value comes from organizational knowledge, and so does its risk. Audit permissions first, especially broad read-access folders."
      }
    },
    {
      title: { zh: "从办公高频任务开始", en: "Start with frequent office tasks" },
      body: {
        zh: "优先测试会议总结、邮件草稿、PPT 大纲、文档改写这些低风险高频流程。",
        en: "Prioritize meeting summaries, email drafts, deck outlines and document rewrites: frequent, low-risk workflows."
      }
    },
    {
      title: { zh: "建立人工复核规则", en: "Add human review rules" },
      body: {
        zh: "对外邮件、合同、财务和人事内容不要自动发送，必须保留人工确认。",
        en: "Do not auto-send external emails, contracts, finance or HR content. Keep human confirmation in the loop."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Microsoft Copilot 首页", en: "Microsoft Copilot home" }, url: "https://www.microsoft.com/microsoft-copilot" },
    { label: { zh: "Copilot 支持文档", en: "Copilot support" }, url: "https://support.microsoft.com/copilot" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：Microsoft Copilot 更像企业办公知识助手，不是通用 Agent 平台。它适合已在 Microsoft 365 里沉淀资料的组织，前提是权限治理先做好。",
    en: "AgentLens advice: Microsoft Copilot is an enterprise productivity assistant, not a generic agent platform. It fits organizations already living in Microsoft 365, provided permissions are governed first."
  },
  commonPitfalls: [
    { zh: "没有清权限就上线，导致员工能通过 Copilot 发现本来不该看的资料。", en: "Rolling out before permission cleanup, letting users discover documents they should not see." },
    { zh: "把会议总结当作正式记录，忽略发言人和上下文错误。", en: "Treating meeting summaries as official minutes without checking speakers and context." }
  ]
};
