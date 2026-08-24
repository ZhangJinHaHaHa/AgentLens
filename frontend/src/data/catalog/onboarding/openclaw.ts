import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * OpenClaw 指南定义多渠道消息 Agent 的最小安全试跑：来源是官方站点/文档，输出先限定测试频道和
 * 只读摘要，再配置工具白名单，最后才讨论经人工确认的外发。
 * openclaw 是精选目录与指南注册共用的稳定 id，不能因历史拼写标签、具体消息渠道或部署实例改变。
 * 步骤原序直接表达 read→draft→send 的权限升级并由详情页编号，任何展示重排都会模糊不可逆发送边界。
 * 本文件不保存 Telegram/Slack/WhatsApp 凭证、不读取联系人、不调用工具，也绝不发送或转发消息。
 * 渠道 API 不可用、授权不足、日志缺失或用户拒绝确认时，运行必须停止并保留失败记录；指南内容
 * 只能教育用户，不能替代服务端权限分层与审计。
 */
export const guide: OnboardingGuide = {
  agentId: "openclaw",
  prerequisites: [
    { zh: "可用的 OpenClaw 部署或测试环境。", en: "An available OpenClaw deployment or test environment." },
    { zh: "测试频道或测试联系人，不要先接生产群聊。", en: "Test channels or contacts; do not start with production group chats." },
    { zh: "明确允许读取、回复、转发和调用工具的范围。", en: "Define what it may read, reply to, forward, and call as tools." }
  ],
  firstStep: {
    zh: "先在测试频道跑一个只读消息摘要任务，确认消息权限、日志和人工确认可用。",
    en: "Start with a read-only message-summary task in a test channel and verify permissions, logs, and approval."
  },
  steps: [
    {
      title: { zh: "接测试消息入口", en: "Connect a test message channel" },
      body: {
        zh: "先接 Telegram/Slack/WhatsApp 的测试空间，只允许读取和生成草稿。",
        en: "Connect a Telegram, Slack, or WhatsApp test space first, allowing reads and draft generation only."
      }
    },
    {
      title: { zh: "配置工具白名单", en: "Configure tool allowlists" },
      body: {
        zh: "只开放必要工具，例如查资料、创建草稿任务、写测试表格。",
        en: "Expose only necessary tools, such as lookup, draft task creation, and test-sheet writes."
      }
    },
    {
      title: { zh: "上线前加发送确认", en: "Add send confirmation" },
      body: {
        zh: "任何外发消息、转发、群通知或客户触达都必须先人工确认。",
        en: "Any outbound message, forward, group notification, or customer contact must be approved first."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "OpenClaw 官网", en: "OpenClaw home" }, url: "https://openclaw.ai/" },
    { label: { zh: "OpenClaw 文档", en: "OpenClaw docs" }, url: "https://docs.openclaw.ai/" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：OpenClaw 适合进入消息/工作流地图。平台要把渠道凭证留在服务端，并把每次发送动作留痕。",
    en: "AgentLens advice: OpenClaw fits the messaging/workflow map. Keep channel credentials server-side and record every send action."
  },
  commonPitfalls: [
    { zh: "直接接生产群聊，机器人误发消息会很难补救。", en: "Connecting production groups directly makes mistaken sends hard to recover from." },
    { zh: "没有区分读取、草稿和真实发送权限。", en: "Not separating read, draft, and real-send permissions." }
  ]
};
