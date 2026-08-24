import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * MeetingDigest 是 AgentLens 自营的文本整理指南，输入限定为用户主动粘贴的纪要、访谈、聊天或邮件串，
 * 输出契约是摘要、决议、行动项表格和待确认问题，而不是企业通信系统集成说明。
 * meeting-digest 同时标识精选卡、平台路由和本指南，属于持久产品键；内部实现或模型网关更换不应改 id。
 * “保留原始上下文→指定输出结构→人工确认行动项”的数组顺序直接成为详情页编号，确保展示不把
 * 推断内容当作已确认事实。这里不读取邮箱/日历/录音，不发送通知，也不创建真实待办或截止日期。
 * 原文缺少负责人、时间或决策时必须输出待确认；模型网关失败或文本不可用时应让运行记录失败，
 * 不能由静态示例补齐不存在的信息。
 */
export const guide: OnboardingGuide = {
  agentId: "meeting-digest",
  prerequisites: [
    {
      zh: "准备一段非敏感会议纪要、访谈稿、群聊记录或邮件串文本。",
      en: "Prepare non-sensitive meeting notes, interview transcript, chat log, or email-thread text."
    },
    {
      zh: "确认当前目标是整理和分配任务，不是自动发送邮件、建日历或读取企业系统。",
      en: "Confirm the goal is digesting and assigning work, not automatically sending emails, creating calendar events, or reading enterprise systems."
    }
  ],
  firstStep: {
    zh: "把一段会议记录粘贴进平台工作区，要求输出“摘要、决议、行动项表格、待确认问题”。",
    en: "Paste meeting notes into the platform workspace and ask for a summary, decisions, action-item table, and open questions."
  },
  steps: [
    {
      title: { zh: "粘贴原始记录", en: "Paste the raw record" },
      body: {
        zh: "可以是会议转写、微信群聊、客户访谈或邮件串。尽量保留说话人、时间和上下文。",
        en: "Use a meeting transcript, chat log, customer interview, or email thread. Keep speaker names, dates, and context when possible."
      }
    },
    {
      title: { zh: "指定输出格式", en: "Choose the output shape" },
      body: {
        zh: "默认输出摘要、决议、行动项表格、待确认问题和下一步；也可以要求只输出行动项。",
        en: "The default output is summary, decisions, action table, open questions, and next steps; you can ask for action items only."
      }
    },
    {
      title: { zh: "人工确认行动项", en: "Confirm action items" },
      body: {
        zh: "如果负责人或截止时间缺失，MeetingDigest 会标成待确认。真实发送、建日历和通知需要后续权限层。",
        en: "Missing owners or deadlines are marked as to-confirm. Sending, calendar creation, and notifications need a later permission layer."
      }
    }
  ],
  officialDocs: [
    {
      label: { zh: "AgentLens 平台工作区", en: "AgentLens workspace" },
      url: "https://agentlens.local/meeting-digest"
    }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：先让普通用户用粘贴文本跑通会议/邮件整理，等输出稳定后再接邮箱、日历、语音转写和企业知识库。",
    en: "AgentLens advice: first make pasted-text meeting/email digest reliable for everyday users; then connect email, calendars, transcription, and enterprise knowledge."
  },
  commonPitfalls: [
    {
      zh: "把它包装成已经能自动读取用户邮箱或日历。",
      en: "Presenting it as if it can already read the user's email or calendar automatically."
    },
    {
      zh: "在原文没有信息时编造负责人、截止日期或决策。",
      en: "Inventing owners, deadlines, or decisions when the source text does not contain them."
    }
  ]
};
