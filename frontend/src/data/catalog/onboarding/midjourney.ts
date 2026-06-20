import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "midjourney",
  prerequisites: [
    { zh: "Discord 账号（目前 Midjourney 通过 Discord Bot 或 midjourney.com Web 入口使用）。", en: "A Discord account — Midjourney currently works via Discord bot or the midjourney.com web interface." },
    { zh: "订阅基础计划（Basic 最低可选）。", en: "A paid plan — Basic tier is the minimum entry." },
    { zh: "明确使用场景：营销素材、UI 概念图、插画还是产品渲染。", en: "Know your use case: marketing visuals, UI mockups, illustration or product renders." }
  ],
  firstStep: {
    zh: "访问 midjourney.com 登录后可直接在 Web 界面输入提示词；或加入 Midjourney Discord 服务器在 #newbies 频道用 /imagine 指令。",
    en: "Go to midjourney.com — sign in and type prompts directly in the Web UI; or join the Midjourney Discord and use /imagine in a #newbies channel."
  },
  steps: [
    {
      title: { zh: "掌握基本提示词结构", en: "Learn the basic prompt structure" },
      body: {
        zh: "好的提示词结构：主体 + 风格 + 光照 + 参数。例如：a minimalist office workspace, morning light, flat design --ar 16:9 --v 6",
        en: "A good prompt: subject + style + lighting + flags. Example: a minimalist office workspace, morning light, flat design --ar 16:9 --v 6"
      }
    },
    {
      title: { zh: "用 --style、--ar、--v 控制输出", en: "Control output with --style, --ar and --v" },
      body: {
        zh: "--ar 控制宽高比（1:1 方形 / 16:9 横版 / 9:16 竖版），--v 6 是当前最新版本，--style raw 减少模型的美化处理。",
        en: "--ar sets aspect ratio (1:1 square / 16:9 landscape / 9:16 portrait). --v 6 is the current version. --style raw reduces the model's automatic beautification."
      }
    },
    {
      title: { zh: "用 Remix 和 Vary 迭代", en: "Iterate with Remix and Vary" },
      body: {
        zh: "选中一张满意的图，点 V 变体生成近似图，U 放大高分辨率。开启 Remix Mode 可以在变体时修改提示词。",
        en: "Click V under a result to generate variations; U to upscale. Enable Remix Mode to edit the prompt as you vary."
      }
    },
    {
      title: { zh: "商用授权确认", en: "Confirm commercial rights" },
      body: {
        zh: "付费计划默认拥有商用权，但 Pro 以下计划生成的图片在 Discord 社区是公开可见的，注意敏感素材不要在公共频道生成。",
        en: "Paid plans include commercial use. Below Pro tier, generated images are visible in the community gallery — don't generate sensitive materials in shared channels."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Midjourney 快速入门", en: "Midjourney quick-start" }, url: "https://docs.midjourney.com/hc/en-us/articles/360043691552" },
    { label: { zh: "提示词参考", en: "Prompt reference" }, url: "https://docs.midjourney.com/hc/en-us/articles/360043691572" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：团队共用时建立一个提示词库（Notion / 内部文档均可），沉淀品牌风格关键词和禁用词，避免每次重头写。",
    en: "AgentLens advice: maintain a shared prompt library (Notion or an internal doc) with brand style keywords and blocked terms — stops everyone rewriting from scratch."
  },
  commonPitfalls: [
    { zh: "提示词太长太复杂，Midjourney 只会挑选部分词权重处理，往往不如简洁提示词效果好。", en: "Overly long prompts — Midjourney weights only parts of them and often produces better results from shorter, focused descriptions." },
    { zh: "忘记检查版权和商用条款，尤其是含有名人、品牌 logo 元素的生成图。", en: "Forgetting to check IP and commercial terms, especially for outputs referencing celebrities or brand logos." }
  ]
};
