import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "replit-agent",
  prerequisites: [
    { zh: "Replit 账号；推荐订阅 Replit Core，把每月 Agent 配额拿足。", en: "A Replit account — Replit Core gives you a usable monthly Agent quota." },
    { zh: "想清楚 MVP 的核心流程；Replit Agent 强在“立刻就能跑”，不擅长极复杂架构。", en: "Decide the core MVP flow up front. Replit Agent shines at 'works right now' — not at heavy architecture." }
  ],
  firstStep: {
    zh: "在 replit.com/agent 输入需求（比如 “搭一个待办 SaaS”），Agent 会立刻起一个 Repl 并填好骨架。",
    en: "On replit.com/agent describe what you want (e.g. 'build a TODO SaaS') and the Agent scaffolds a fresh Repl."
  },
  steps: [
    {
      title: { zh: "对话迭代功能", en: "Iterate via chat" },
      body: {
        zh: "在右侧聊天里告诉 Agent “加一个登录页”、“改成深色主题”，每次接受改动前看 diff。",
        en: "Tell the Agent in chat to 'add a login page' or 'switch to dark mode'. Always inspect the diff before accepting."
      }
    },
    {
      title: { zh: "接入数据存储", en: "Wire storage" },
      body: {
        zh: "默认走 Replit DB / Object Storage；要持久化到自有 DB，就在 Secrets 里贴连接串再让 Agent 改代码。",
        en: "Defaults to Replit DB / Object Storage. For your own DB, drop the connection string into Secrets and ask the Agent to swap drivers."
      }
    },
    {
      title: { zh: "一键部署", en: "Deploy" },
      body: {
        zh: "Deployments → Autoscale 默认即可；要给客户演示就绑定自定义域名。",
        en: "Deployments → Autoscale is fine for demos. Bind a custom domain when you start showing customers."
      }
    },
    {
      title: { zh: "做安全收尾", en: "Lock things down" },
      body: {
        zh: "上线前关 Agent 的 “run shell as root” 权限、禁掉 prod 环境写敏感 secret。",
        en: "Before going live, revoke the Agent's root shell permission and strip secrets it shouldn't touch."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Replit Agent 文档", en: "Replit Agent docs" }, url: "https://docs.replit.com/replit-agent" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议把 Replit Agent 留给“做完就丢”的实验项目；要长期维护的代码，迁出 Replit 后用自己的 CI/CD。",
    en: "AgentLens advice: keep Replit Agent for throwaway experiments. Migrate any long-term code into your own CI/CD pipeline."
  },
  commonPitfalls: [
    { zh: "依赖 Replit 默认 secret 管理，被无意识泄露 token。", en: "Trusting default secret management and accidentally leaking tokens." },
    { zh: "Agent 自动迁库到 Replit DB，但忘了导出备份。", en: "Letting the Agent migrate to Replit DB without exporting a backup." }
  ]
};
