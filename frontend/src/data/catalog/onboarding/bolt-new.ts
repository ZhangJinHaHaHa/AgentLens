import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * 本指南描述 Bolt.new 在浏览器 WebContainer 中生成并导出 Node/React 原型的路径，资料来自
 * StackBlitz 公开文档，产出是供详情页阅读的操作顺序与依赖边界，不是可执行项目模板。
 * bolt-new 是目录、指南 Map 和详情链接共用的持久键；产品标点或品牌展示名变化不构成改 id 的理由。
 * 步骤从运行时限制到多文件迭代、GitHub 交接和部署评估排列，编号顺序体现“先验证兼容再交付”的契约。
 * 本文件禁止承担 WebContainer 依赖探测、源码导出、Secret 扫描或部署逻辑，也不保证 native 模块可用。
 * 浏览器启动失败、不支持的底层 IO、导出后泄密都应由实际产品/审核流程处理；文档链接或界面路径
 * 过期时应明确更新静态资料，不能伪装成平台已经完成部署。
 */
export const guide: OnboardingGuide = {
  agentId: "bolt-new",
  prerequisites: [
    { zh: "现代浏览器（Chromium/Edge/Brave）+ StackBlitz 账号。", en: "A Chromium-based browser (Chrome/Edge/Brave) and a StackBlitz account." },
    { zh: "想清楚“是否需要 Node 全栈”，否则纯前端 demo 用 v0 更顺。", en: "Confirm you actually need a Node full-stack runtime — for pure front-end demos v0 is smoother." }
  ],
  firstStep: {
    zh: "去 bolt.new 直接输入 “搭一个 Express + React 的 todo 应用”，等 WebContainer 启动。",
    en: "Open bolt.new and ask 'build an Express + React TODO app'. Wait for WebContainer to spin up."
  },
  steps: [
    {
      title: { zh: "理解 WebContainer 限制", en: "Know WebContainer limits" },
      body: {
        zh: "Bolt 在浏览器里跑 Node，所以原生模块/低层 IO 可能不支持，要先在依赖列表里确认。",
        en: "Bolt runs Node in the browser — native modules and low-level IO may not work. Vet your deps first."
      }
    },
    {
      title: { zh: "持续对话改代码", en: "Iterate by chat" },
      body: {
        zh: "右侧聊天里说 “加一个 PostgreSQL 接口、用 Drizzle ORM”，让 Bolt 一次帮你改多文件。",
        en: "In the chat panel, ask Bolt to 'add a Postgres binding using Drizzle ORM' so it edits multiple files in one go."
      }
    },
    {
      title: { zh: "导出到 GitHub", en: "Export to GitHub" },
      body: {
        zh: "Project Settings → Export to GitHub，把项目转入团队仓库做正式审查。",
        en: "Project Settings → Export to GitHub to move the code into your team repo for proper review."
      }
    },
    {
      title: { zh: "评估部署路径", en: "Plan deployment" },
      body: {
        zh: "Bolt 自身不托管生产环境，建议接 Vercel/Railway/Fly 走正式部署。",
        en: "Bolt does not host production — wire to Vercel / Railway / Fly for a real deployment."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "StackBlitz 文档", en: "StackBlitz docs" }, url: "https://stackblitz.com/docs" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议把 Bolt 用于现场演示和教学，不要直接当成生产代码仓库。",
    en: "AgentLens advice: keep Bolt for live demos and teaching. Don't treat it as your production source of truth."
  },
  commonPitfalls: [
    { zh: "依赖 native 模块（如 sharp）就会失败。", en: "Depending on native modules like `sharp` simply fails inside WebContainer." },
    { zh: "在 Bolt 里塞秘密，导出后 secret 仍在源码里。", en: "Pasting secrets into Bolt — they end up in the exported source." }
  ]
};
