import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * Manus 指南的核心不是复刻封闭产品，而是说明“平台任务包 + 低风险替代 + 官方跳转”的交付边界；
 * 内容来源于 Manus 官方入口和 AgentLens 当前接入能力，输出必须始终保留官方/平台能力区分。
 * manus 是现有目录 URL 和指南注册的稳定 id，不能因暂未托管而改成候选后缀，也不能冒充官方实例 id。
 * 步骤先整理验收条件、再分流执行能力、最后重复边界说明，编号次序用于防止用户把准备工作误认成执行。
 * 本数据不登录 Manus、不操作账号、不付款、不提交表单，也不把平台研究结果标成官方运行结果。
 * 官方账号不可用或任务需要真实账号动作时，应跳转/拒绝并说明原因；若平台替代能力也覆盖不了，
 * 正确输出是边界外，而不是根据指南文字模拟“已完成”。
 */
export const guide: OnboardingGuide = {
  agentId: "manus",
  prerequisites: [
    { zh: "Manus 官方账号；平台暂不承诺代替官方运行环境。", en: "A Manus official account; AgentLens does not yet replace the official runtime." },
    { zh: "把任务拆成目标、资料、限制和是否允许登录/提交四部分。", en: "Split the task into goal, materials, limits, and whether login/submission is allowed." },
    { zh: "涉及真实账号动作时，用户必须显式授权。", en: "Real-account actions require explicit user permission." }
  ],
  firstStep: {
    zh: "先让平台工作区帮用户整理任务包：背景、目标、可用资料和禁止动作，然后跳转官方 Manus 或用平台替代能力执行低风险部分。",
    en: "First let AgentLens prepare a task package with context, goals, materials, and blocked actions; then hand off to official Manus or run low-risk substitutes."
  },
  steps: [
    {
      title: { zh: "整理任务包", en: "Prepare the task package" },
      body: {
        zh: "把用户一句话需求转成目标、步骤、资料链接和验收标准，减少官方侧来回沟通。",
        en: "Turn a one-line request into goals, steps, links, and acceptance criteria to reduce back-and-forth official-side."
      }
    },
    {
      title: { zh: "区分官方与平台能力", en: "Separate official and platform capabilities" },
      body: {
        zh: "研究、总结、规划可以先由平台做；真实账号操作、复杂网页执行优先官方或后续沙箱。",
        en: "AgentLens can handle research, summaries, and planning; real account actions and complex web execution stay official-first or need a sandbox."
      }
    },
    {
      title: { zh: "保留边界说明", en: "Keep boundaries visible" },
      body: {
        zh: "卡片和工作区必须明确：这不是官方 Manus 完整客户端，只是平台承接部分能力。",
        en: "The card and workspace must say clearly: this is not the full official Manus client, only AgentLens-covered capability."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Manus 官网", en: "Manus home" }, url: "https://manus.im" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：Manus 暂时按“官方优先 + 平台任务包 + 低风险替代能力”上线，不要说成已经完整接入。",
    en: "AgentLens advice: launch Manus as official-first plus task package plus low-risk substitutes, not as a fully integrated runtime."
  },
  commonPitfalls: [
    { zh: "把封闭官方产品包装成平台内已完整运行。", en: "Presenting a closed official product as fully running inside AgentLens." },
    { zh: "没有区分只读研究和真实账号动作。", en: "Failing to separate read-only research from real-account actions." }
  ]
};
