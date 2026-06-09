import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "cursor",
  prerequisites: [
    { zh: "Mac / Windows / Linux 桌面环境。", en: "Mac, Windows or Linux desktop." },
    { zh: "已经迁移过 VS Code 配置（Cursor 兼容大多数扩展）。", en: "VS Code config you can import — Cursor is compatible with most extensions." },
    { zh: "如果是企业仓库，先开启 Privacy Mode。", en: "For company repos, turn Privacy Mode on first." }
  ],
  firstStep: {
    zh: "去 cursor.com 下载安装，第一次启动时选 “Import from VS Code”。",
    en: "Install from cursor.com and pick \"Import from VS Code\" on first launch."
  },
  steps: [
    {
      title: { zh: "安装与登录", en: "Install and sign in" },
      body: {
        zh: "用 GitHub 或 Google 登录，免费层立刻可用。",
        en: "Sign in with GitHub or Google — the free tier is usable right away."
      }
    },
    {
      title: { zh: "选择默认模型", en: "Pick a default model" },
      body: {
        zh: "在 Settings → Models 里设置默认模型；建议先选 Claude 4.x 处理长上下文，OpenAI o-series 处理 Agent 调用。",
        en: "In Settings → Models pick a default. Claude 4.x handles long context well, OpenAI o-series shines for agent flows."
      }
    },
    {
      title: { zh: "打开第一个仓库", en: "Open your first repo" },
      body: {
        zh: "用 cmd+L 唤出对话窗口，先做 “解释这段代码”，验证模型是否能正确读到当前文件。",
        en: "Hit ⌘L to open the chat panel and ask 'explain this file' to confirm the model can see the current buffer."
      }
    },
    {
      title: { zh: "用 Composer 跑跨文件改动", en: "Run a cross-file edit with Composer" },
      body: {
        zh: "按 cmd+I 进入 Composer，描述一段需求，让它一次提交多文件 diff。",
        en: "Press ⌘I for Composer and describe a multi-file change. Approve diffs file by file."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Cursor 文档", en: "Cursor docs" }, url: "https://docs.cursor.com" },
    { label: { zh: "Cursor 团队管理", en: "Team management" }, url: "https://docs.cursor.com/account/teams" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议团队层面统一一个 .cursor/rules 文件，把代码规范、PR 模板都写进去，避免每位同事自己 prompt。",
    en: "AgentLens advice: maintain a shared .cursor/rules so code conventions and PR templates are baked in — no one re-prompts from scratch."
  },
  commonPitfalls: [
    { zh: "默认上传上下文，敏感仓库忘了开 Privacy Mode。", en: "Forgetting to flip Privacy Mode on for sensitive repos — context is uploaded by default." },
    { zh: "不维护 .cursorignore，把生成产物 / node_modules 一起喂给模型。", en: "Skipping .cursorignore, so build artefacts and node_modules pollute the prompt." }
  ]
};
