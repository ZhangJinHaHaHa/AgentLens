import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * 本指南把 ChatGPT 消费者入口与 OpenAI API 评估放在同一通用助手路径中，资料来自官方帮助中心和
 * Platform 文档，输出用于说明 Project、文件工具与隐私检查的上手次序，而非定义模型路由。
 * openai-gpt5 是目录既有产品族 id；具体模型、套餐和功能名称可迭代，但不能据此频繁改动连接键，
 * 否则精选卡和指南 Map 会失配。步骤数组的顺序与详情页编号绑定，先建立上下文再试工具并检查数据控制。
 * 这里不登录账号、不创建 Project、不选择模型、不上传文件，也不执行 API 或下游工具动作。
 * 模型不可用、工具输出错误或隐私设置不满足组织要求时，真实服务必须失败/停用；模型名称和界面路径
 * 是需人工复核的时效信息，静态指南不得被当作能力发现或合规证明。
 */
export const guide: OnboardingGuide = {
  agentId: "openai-gpt5",
  prerequisites: [
    { zh: "拥有一个可访问 chat.openai.com 的账号；如要 API，要在 platform.openai.com 开通付费。", en: "Account on chat.openai.com. For API access, enable billing on platform.openai.com." },
    { zh: "明确这一步是评估“通用助手”，不是替代专业垂类工具。", en: "Be clear you are evaluating a general assistant — not a vertical replacement." }
  ],
  firstStep: {
    zh: "登录 chat.openai.com，把第一个对话设为 Project，给它写明任务背景和限制。",
    en: "Sign in to chat.openai.com and create the first conversation as a Project with a clear brief and constraints."
  },
  steps: [
    {
      title: { zh: "选模型", en: "Pick the right model" },
      body: {
        zh: "对话场景默认走 GPT-5；要工具调用 / Agent 能力时切到 GPT-5 thinking 或 o-series。",
        en: "Default to GPT-5 for chat. Switch to GPT-5 thinking / o-series when you need tool use or longer reasoning."
      }
    },
    {
      title: { zh: "组建 Project", en: "Set up a Project" },
      body: {
        zh: "把背景知识、文件、自定义指令固定到 Project 里，避免每次对话都重新粘贴。",
        en: "Stash background knowledge, files and custom instructions inside a Project so you stop re-pasting context."
      }
    },
    {
      title: { zh: "试一次工具调用", en: "Try a tool call" },
      body: {
        zh: "让它读一份 PDF 或 csv 并出图，验证多模态 / Code Interpreter 是否符合预期。",
        en: "Have it read a PDF / csv and chart something — confirms multimodal + Code Interpreter behave as you expect."
      }
    },
    {
      title: { zh: "评估安全与隐私", en: "Review privacy posture" },
      body: {
        zh: "Settings → Data Controls 关闭 “Improve the model”，企业版可走 SSO + 数据留存策略。",
        en: "Settings → Data Controls: turn off 'Improve the model'. Enterprise tier exposes SSO + retention policies."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "ChatGPT 帮助中心", en: "ChatGPT help" }, url: "https://help.openai.com" },
    { label: { zh: "OpenAI Platform 文档", en: "OpenAI Platform docs" }, url: "https://platform.openai.com/docs" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议先用 Project 把团队最常做的任务模板化，再决定哪些任务真的值得迁去 API。",
    en: "AgentLens advice: template your team's most common tasks inside Projects first, then decide which are worth moving onto the API."
  },
  commonPitfalls: [
    { zh: "把核心商业数据直接粘进对话，且未开企业版。", en: "Pasting core business data into chats without Enterprise privacy." },
    { zh: "对工具调用的输出没有人审就接入下游系统。", en: "Wiring tool-call output into downstream systems without a human review step." }
  ]
};
