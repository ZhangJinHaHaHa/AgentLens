import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "claude-code",
  prerequisites: [
    { zh: "已经在 console.anthropic.com 拿到 API Key 或开通 Claude Code 订阅。", en: "Have an Anthropic API key or a Claude Code subscription on console.anthropic.com." },
    { zh: "本地装好 Node.js 18+ 与 git。", en: "Local Node.js 18+ and git installed." },
    { zh: "目标仓库做了一次干净 commit，便于回滚。", en: "Your target repo has a clean commit so you can roll back." }
  ],
  firstStep: {
    zh: "在终端运行 `npm install -g @anthropic-ai/claude-code`，然后在仓库根目录执行 `claude` 进入交互。",
    en: "Run `npm install -g @anthropic-ai/claude-code`, then `claude` in your repo root to start a session."
  },
  steps: [
    {
      title: { zh: "安装 CLI", en: "Install the CLI" },
      body: {
        zh: "推荐用 npm 全局安装；如果在受控环境，可改成 npx 单次执行。",
        en: "We recommend `npm install -g`. In locked-down environments use `npx @anthropic-ai/claude-code` per session."
      },
      codeBlock: "npm install -g @anthropic-ai/claude-code"
    },
    {
      title: { zh: "登录账号", en: "Authenticate" },
      body: {
        zh: "首次运行会让你在浏览器登录 Anthropic 账号；可改成 `ANTHROPIC_API_KEY=...` 环境变量。",
        en: "The first run sends you to a browser sign-in. Alternatively set the `ANTHROPIC_API_KEY` env var."
      }
    },
    {
      title: { zh: "限定权限", en: "Scope permissions" },
      body: {
        zh: "在 ~/.claude/settings.json 里设置 `defaultMode: \"plan\"` 并把可写路径列入 allowlist。",
        en: "Edit ~/.claude/settings.json so `defaultMode: \"plan\"` and writable paths sit in an explicit allowlist."
      }
    },
    {
      title: { zh: "跑一个真实任务", en: "Run a real task" },
      body: {
        zh: "尝试 “/edit 在 lib/foo.ts 里加上单元测试”——观察工具调用是否在你预期范围内。",
        en: "Try `/edit add unit tests for lib/foo.ts` — watch whether tool calls stay inside your expected scope."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Claude Code 文档", en: "Claude Code docs" }, url: "https://docs.claude.com/claude-code" },
    { label: { zh: "权限模型", en: "Permission model" }, url: "https://docs.claude.com/claude-code/permissions" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议第一周只在分支上跑 Claude Code，搭配 git pre-commit hook 强制 review；积累几次稳定记录后再开放到主仓库。",
    en: "AgentLens advice: spend the first week running Claude Code only on branches, with a git pre-commit hook enforcing review. Promote to main only after a few stable runs."
  },
  commonPitfalls: [
    { zh: "把整个 monorepo 一次扔给 Claude Code，token 成本会失控。", en: "Throwing an entire monorepo at it once will blow your token budget." },
    { zh: "没限制工具白名单，长任务可能 `rm -rf` 越权目录。", en: "Without an explicit tool allowlist, long tasks can `rm -rf` outside your intended scope." }
  ]
};
