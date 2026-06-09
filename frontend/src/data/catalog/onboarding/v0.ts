import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "v0",
  prerequisites: [
    { zh: "已有 Vercel 账号；如果要部署到生产环境需要绑定一个 Vercel 项目。", en: "Vercel account ready; bind a Vercel project if you plan to deploy." },
    { zh: "提前准备好品牌色 / Logo 等视觉资源以加快定制。", en: "Brand colours / logo handy so you can iterate faster on visuals." }
  ],
  firstStep: {
    zh: "去 v0.dev，输入 “搭一个 SaaS 落地页，用 Tailwind + shadcn”，先看默认产物。",
    en: "Open v0.dev and prompt 'build a SaaS landing page with Tailwind + shadcn' — start from the default output."
  },
  steps: [
    {
      title: { zh: "选项目模式", en: "Pick the project mode" },
      body: {
        zh: "对话顶部切 “v0 Project”，可以保留多文件结构，便于后续 hand-off 给工程师。",
        en: "Toggle to v0 Project at the top — multi-file output makes hand-off to engineers easier."
      }
    },
    {
      title: { zh: "在浏览器内迭代", en: "Iterate in browser" },
      body: {
        zh: "用 prompt + 截图反复说 “这块改成卡片网格”、“按钮改用主品牌色”，每次都看 diff。",
        en: "Iterate with prompts and screenshots: 'turn this into a card grid', 'use brand primary on buttons'. Inspect the diff each time."
      }
    },
    {
      title: { zh: "下载或部署", en: "Download or deploy" },
      body: {
        zh: "右上 Deploy 按钮一键发到 Vercel；如要本地继续，按 “Download” 拿到完整 Next.js 工程。",
        en: "Use the Deploy button to ship to Vercel, or hit Download for a full Next.js project to keep iterating locally."
      }
    },
    {
      title: { zh: "做一次代码审查", en: "Do a code pass" },
      body: {
        zh: "重点检查 server actions 是否裸跑、依赖是否最新、accessibility 是否过关。",
        en: "Sanity-check server actions, dependency freshness, and accessibility before shipping."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "v0 文档", en: "v0 docs" }, url: "https://v0.dev/docs" },
    { label: { zh: "shadcn 组件库", en: "shadcn registry" }, url: "https://ui.shadcn.com" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议先用 v0 出可演示原型，再让工程师 PR 接管；不要把 v0 直接当成长期生产代码持有人。",
    en: "AgentLens advice: ship the demo with v0, then have engineers take over via PR. Don't treat v0 as the long-term owner of production code."
  },
  commonPitfalls: [
    { zh: "默认依赖偶有过期版本，需要执行一次 `pnpm up -L`。", en: "Default deps occasionally lag — run `pnpm up -L` after download." },
    { zh: "把 v0 输出当作 final 代码上线，没人做 a11y / SEO 校验。", en: "Shipping v0 output as final code without an accessibility / SEO review." }
  ]
};
