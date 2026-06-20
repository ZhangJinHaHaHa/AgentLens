import type { AgentCatalogEntry } from "@/domain/catalog";

import { scenario } from "./scenarios";

/**
 * Listed agents — baseline metadata only. We track them so users searching
 * by name can find them, but we have not run them in depth and there is no
 * onboarding guide. Trust tier defaults to 0 unless an observation arrives.
 */
export const listedAgents: AgentCatalogEntry[] = [
  {
    id: "github-copilot",
    source: "listed",
    name: "GitHub Copilot",
    vendor: "GitHub / Microsoft",
    intro: {
      zh: "GitHub 的 IDE 内 AI 助手，覆盖 VS Code / JetBrains / Neovim，企业版强项是组织级合规与审计。",
      en: "GitHub's in-IDE AI assistant across VS Code/JetBrains/Neovim. Enterprise tier emphasises org-level compliance and audit."
    },
    category: "AI IDE assistant",
    tags: ["ide", "github", "copilot"],
    scenarios: [scenario("ide-coding"), scenario("developer-assistant")],
    unsuitableScenarios: [scenario("customer-support")],
    recommendedFor: [
      { zh: "已经在 GitHub 生态内的企业团队", en: "Enterprise teams already inside the GitHub ecosystem" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "默认会向云端模型上传上下文片段。", en: "Sends context snippets to the cloud model by default." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://github.com/features/copilot",
    docsUrl: "https://docs.github.com/copilot"
  },
  {
    id: "windsurf",
    source: "listed",
    name: "Windsurf",
    vendor: "Codeium",
    intro: {
      zh: "Codeium 推出的 AI IDE，主打 Cascade Agent 和大跨度多文件改动。",
      en: "Codeium's AI IDE; the headline feature is Cascade Agent for cross-file edits."
    },
    category: "AI IDE",
    tags: ["ide", "codeium", "cascade"],
    scenarios: [scenario("ide-coding"), scenario("developer-assistant"), scenario("agentic-coding")],
    unsuitableScenarios: [scenario("customer-support")],
    recommendedFor: [
      { zh: "正在评估 Cursor 替代方案的团队", en: "Teams evaluating Cursor alternatives" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "Cascade Agent 长任务期间需关注 token 消耗。", en: "Watch token spend during long Cascade runs." }
    ],
    accessTypes: ["local", "saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://windsurf.com",
    docsUrl: "https://docs.windsurf.com"
  },
  {
    id: "you-com",
    source: "listed",
    name: "You.com",
    vendor: "You.com",
    intro: {
      zh: "可选模型的 AI 搜索引擎，适合做对比型搜索。",
      en: "AI search engine with model picker — good for cross-model comparison searches."
    },
    category: "AI search",
    tags: ["search", "research"],
    scenarios: [scenario("market-research"), scenario("knowledge-qa")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "想同时看几个模型给出的答案", en: "Users that want answers from several models side-by-side" }
    ],
    riskLevel: "low",
    riskNotes: [],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://you.com"
  },
  {
    id: "notion-ai",
    source: "listed",
    name: "Notion AI",
    vendor: "Notion",
    intro: {
      zh: "嵌入 Notion 工作区的写作 / 总结 / 自动化助手。",
      en: "Writing, summarisation and automation assistant embedded in the Notion workspace."
    },
    category: "Knowledge assistant",
    tags: ["notion", "writing", "summary"],
    scenarios: [scenario("content-generation"), scenario("knowledge-qa"), scenario("workflow-automation")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "已经把知识库放在 Notion 的团队", en: "Teams that already store the knowledge base in Notion" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "对外引用的内容由 Notion 的连接器决定，需事先核实权限范围。", en: "External references depend on the Notion connectors — confirm scope before rolling out." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://www.notion.so/product/ai"
  },
  {
    id: "zapier-agents",
    source: "listed",
    name: "Zapier Agents",
    vendor: "Zapier",
    intro: {
      zh: "把 5000+ Zapier 应用作为工具调用的自动化 Agent。",
      en: "Automation agent that exposes Zapier's 5000+ app integrations as tools."
    },
    category: "Workflow agent",
    tags: ["automation", "zapier"],
    scenarios: [scenario("workflow-automation"), scenario("customer-support")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "已经用 Zapier 串流程的运营 / 销售团队", en: "Ops/sales teams that already orchestrate flows on Zapier" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "工具触发副作用，需要先在沙盒账户跑过。", en: "Tool calls cause side effects — pilot in a sandbox account first." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: true,
    officialUrl: "https://zapier.com/agents"
  },
  {
    id: "n8n-ai",
    source: "listed",
    name: "n8n AI",
    vendor: "n8n",
    intro: {
      zh: "开源工作流引擎 n8n 的 AI 节点，支持自托管的 Agent 编排。",
      en: "AI nodes inside the open-source n8n workflow engine — self-hostable agent orchestration."
    },
    category: "Workflow agent",
    tags: ["automation", "open-source", "self-host"],
    scenarios: [scenario("workflow-automation"), scenario("customer-support")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "希望自托管自动化平台的团队", en: "Teams that need a self-hosted automation platform" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "自托管运维成本由你承担。", en: "Self-hosting ops cost lives on your team." }
    ],
    accessTypes: ["local", "saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: true,
    officialUrl: "https://n8n.io"
  },
  {
    id: "openclaw",
    source: "listed",
    name: "OpenClaw",
    vendor: "OpenClaw / open-source community",
    intro: {
      zh: "中文用户常叫“龙虾”的开源个人 AI 助手网关，把 WhatsApp、Telegram、Slack 等消息入口连接到本机或服务器上的 AI 助手。",
      en: "Open-source personal AI assistant gateway, often nicknamed 'lobster' in Chinese communities, connecting chat channels to an assistant running on your machine or server."
    },
    category: "Personal agent gateway",
    tags: ["openclaw", "openclow", "龙虾", "lobster", "open-source", "self-host", "messaging", "automation"],
    scenarios: [scenario("workflow-automation"), scenario("developer-assistant"), scenario("knowledge-qa")],
    unsuitableScenarios: [scenario("defi-trading")],
    recommendedFor: [
      {
        zh: "想把个人 Agent 常驻在 WhatsApp、Telegram、Slack 等消息入口里的进阶用户",
        en: "Advanced users who want a persistent personal agent inside channels like WhatsApp, Telegram or Slack"
      },
      {
        zh: "能自行管理模型密钥、账号权限、服务器和本地运行环境的技术用户",
        en: "Technical users who can manage model keys, account permissions, servers and local runtime environments"
      }
    ],
    riskLevel: "high",
    riskNotes: [
      {
        zh: "它会桥接聊天账号、模型密钥和工具动作，配置不当可能暴露私人消息或触发非预期操作。",
        en: "It bridges chat accounts, model keys and tool actions; misconfiguration can expose private messages or trigger unintended actions."
      },
      {
        zh: "当前仅作为外部 listed Agent 收录，平台尚未完成审计或起步指南。",
        en: "Currently listed as an external agent only; the platform has not completed an audit or onboarding guide."
      }
    ],
    riskMitigation: [
      {
        zh: "先用低权限账号、测试频道和审批模式试跑，再逐步接入真实邮箱、日程或业务账号。",
        en: "Start with low-privilege accounts, test channels and approval mode before connecting real email, calendar or business accounts."
      },
      {
        zh: "把模型密钥、聊天凭证和插件权限分开管理，并保留运行日志便于排查。",
        en: "Separate model keys, chat credentials and plugin permissions, and keep runtime logs for review."
      }
    ],
    accessTypes: ["local", "cloud", "api"],
    complexity: "high",
    hasOnboardingGuide: false,
    officialUrl: "https://openclaw.ai/",
    docsUrl: "https://docs.openclaw.ai/",
    pricingHint: {
      zh: "开源自托管本体可自行部署；实际成本取决于模型 API、服务器和消息渠道配置。",
      en: "The open-source gateway can be self-hosted; real cost depends on model APIs, hosting and channel setup."
    },
    latestObservedAt: "2026-06-12",
    observationSummary: {
      zh: "已按公开文档收录为 listed：自托管消息网关类 Agent，尚未做平台审计。",
      en: "Listed from public documentation: a self-hosted messaging gateway agent, not yet platform-audited."
    }
  },
  {
    id: "langgraph-platform",
    source: "listed",
    name: "LangGraph Platform",
    vendor: "LangChain",
    intro: {
      zh: "LangChain 的 Agent 编排平台，主打多 Agent 状态机。",
      en: "LangChain's agent orchestration platform centred on multi-agent state machines."
    },
    category: "Agent platform",
    tags: ["langchain", "orchestration", "multi-agent"],
    scenarios: [scenario("workflow-automation"), scenario("agentic-coding"), scenario("data-analysis")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "希望严控 Agent 拓扑结构的工程团队", en: "Engineering teams that want explicit control over agent topology" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "需要团队具备状态机/可观测性建设能力。", en: "Requires solid state-machine and observability practice on the team." }
    ],
    accessTypes: ["saas", "api", "cloud"],
    complexity: "high",
    hasOnboardingGuide: false,
    officialUrl: "https://www.langchain.com/langgraph"
  },
  {
    id: "crewai-platform",
    source: "listed",
    name: "CrewAI",
    vendor: "CrewAI",
    intro: {
      zh: "面向多 Agent 协作的 Python 框架与托管平台。",
      en: "Python framework + managed platform for multi-agent collaboration."
    },
    category: "Multi-agent framework",
    tags: ["python", "framework", "multi-agent"],
    scenarios: [scenario("workflow-automation"), scenario("data-analysis")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "想自定义 Agent 角色与流程的研发团队", en: "Engineering teams that want custom agent roles and flows" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "上手成本与你对 prompt 工程的熟练度强相关。", en: "Ramp time tracks your prompt-engineering chops." }
    ],
    accessTypes: ["api", "local", "cloud"],
    complexity: "high",
    hasOnboardingGuide: false,
    officialUrl: "https://www.crewai.com"
  },
  {
    id: "autogen-studio",
    source: "listed",
    name: "AutoGen Studio",
    vendor: "Microsoft Research",
    intro: {
      zh: "Microsoft 的多 Agent 框架，附带可视化编排工具。",
      en: "Microsoft's multi-agent framework with a visual orchestration studio."
    },
    category: "Multi-agent framework",
    tags: ["microsoft", "framework", "studio"],
    scenarios: [scenario("workflow-automation"), scenario("data-analysis")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "做 Agent 研究 / 快速 PoC 的团队", en: "Teams running agent research or rapid PoCs" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "项目仍在迭代，API 偶有破坏式变更。", en: "Project still iterates — expect occasional breaking API changes." }
    ],
    accessTypes: ["local", "api"],
    complexity: "high",
    hasOnboardingGuide: false,
    officialUrl: "https://github.com/microsoft/autogen"
  },
  {
    id: "elevenlabs",
    source: "listed",
    name: "ElevenLabs",
    vendor: "ElevenLabs",
    intro: {
      zh: "面向语音合成与多语种配音的 AI 平台。",
      en: "AI platform for text-to-speech and multilingual voiceover."
    },
    category: "Voice generation",
    tags: ["voice", "tts", "multilingual"],
    scenarios: [scenario("content-generation"), scenario("customer-support")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "需要批量出多语种音频的内容团队", en: "Content teams shipping multi-language audio at scale" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "克隆人声前要确保获得当事人授权。", en: "Get explicit consent before cloning a real person's voice." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://elevenlabs.io"
  },
  {
    id: "harvey",
    source: "listed",
    name: "Harvey",
    vendor: "Harvey",
    intro: {
      zh: "面向法律 / 专业服务的垂类 Agent，企业部署为主。",
      en: "Vertical agent for legal/professional services, sold mostly to enterprises."
    },
    category: "Vertical agent",
    tags: ["legal", "enterprise"],
    scenarios: [scenario("knowledge-qa"), scenario("market-research")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "正在评估垂类 Agent 替代方案的法务团队", en: "Legal teams evaluating vertical agent options" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "答案仍需律师人审，不能作为最终意见。", en: "Outputs still need attorney review — never the final word." }
    ],
    accessTypes: ["saas"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://www.harvey.ai"
  },
  {
    id: "manus",
    source: "listed",
    name: "Manus",
    vendor: "Butterfly Effect",
    intro: {
      zh: "通用自主任务 Agent，强调从目标出发规划、浏览、生成文件并交付结果。",
      en: "General-purpose autonomous task agent that plans from a goal, browses, creates files and delivers results."
    },
    category: "Generalist agent",
    tags: ["task", "research"],
    scenarios: [scenario("market-research"), scenario("knowledge-qa"), scenario("workflow-automation")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "想试通用 Agent 的早期采纳者", en: "Early adopters trying generalist agents" }
    ],
    riskLevel: "high",
    riskNotes: [
      { zh: "执行能力波动较大，建议小步试用。", en: "Execution quality is variable — start small." }
    ],
    accessTypes: ["saas"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://manus.im"
  },
  {
    id: "openai-operator",
    source: "listed",
    name: "OpenAI Operator",
    vendor: "OpenAI",
    intro: {
      zh: "OpenAI 推出的浏览器操作 Agent，可代用户在网页上完成任务。",
      en: "OpenAI's computer-use agent that drives a browser on the user's behalf."
    },
    category: "Computer-use agent",
    tags: ["openai", "browser", "computer-use"],
    scenarios: [scenario("workflow-automation"), scenario("market-research")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "想试浏览器操作 Agent 的研究 / 早期团队", en: "Research/early-adopter teams exploring computer-use agents" }
    ],
    riskLevel: "high",
    riskNotes: [
      { zh: "操作浏览器有越权风险，必须配合白名单与人审。", en: "Browser actions can overreach — pair with allowlists and human review." }
    ],
    accessTypes: ["saas"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://openai.com/index/introducing-operator"
  },
  {
    id: "google-gemini",
    source: "listed",
    name: "Google Gemini",
    vendor: "Google",
    intro: {
      zh: "Google 的通用多模态助手，覆盖网页、移动端与 Gemini API。",
      en: "Google's general-purpose multimodal assistant across web, mobile and Gemini API access."
    },
    category: "General assistant",
    tags: ["google", "llm", "multimodal"],
    scenarios: [scenario("knowledge-qa"), scenario("content-generation"), scenario("market-research"), scenario("multimodal-chat")],
    unsuitableScenarios: [scenario("defi-trading")],
    recommendedFor: [
      { zh: "已经在 Google Workspace 或 Google Cloud 生态内的团队", en: "Teams already invested in Google Workspace or Google Cloud" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "企业上线前需确认 Workspace / Cloud 数据策略与权限范围。", en: "Confirm Workspace / Cloud data policy and permission scope before enterprise rollout." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://gemini.google.com",
    docsUrl: "https://ai.google.dev/gemini-api/docs"
  },
  {
    id: "microsoft-copilot",
    source: "listed",
    name: "Microsoft Copilot",
    vendor: "Microsoft",
    intro: {
      zh: "Microsoft 365 与 Windows 生态内的通用工作助手，偏向企业办公与知识工作。",
      en: "General work assistant inside the Microsoft 365 and Windows ecosystem, focused on enterprise productivity."
    },
    category: "Productivity assistant",
    tags: ["microsoft", "office", "productivity"],
    scenarios: [scenario("knowledge-qa"), scenario("content-generation"), scenario("workflow-automation")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "邮件、文档、会议已经集中在 Microsoft 365 的组织", en: "Organizations whose mail, docs and meetings already live in Microsoft 365" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "效果依赖租户权限治理，先清理过度共享的文档。", en: "Quality and safety depend on tenant permissions; clean up over-shared documents first." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://www.microsoft.com/microsoft-copilot"
  },
  {
    id: "jasper-ai",
    source: "listed",
    name: "Jasper",
    vendor: "Jasper",
    intro: {
      zh: "面向营销团队的内容生成平台，强调品牌口吻、模板和 campaign 工作流。",
      en: "Content generation platform for marketing teams, emphasizing brand voice, templates and campaign workflows."
    },
    category: "Marketing content agent",
    tags: ["marketing", "writing", "brand"],
    scenarios: [scenario("content-generation"), scenario("workflow-automation")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "需要统一品牌口吻并批量生成营销内容的团队", en: "Teams that need brand-governed marketing content at scale" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "生成内容仍需人工复核事实与版权风险。", en: "Generated copy still needs human review for facts and copyright risk." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://www.jasper.ai"
  },
  {
    id: "runway",
    source: "listed",
    name: "Runway",
    vendor: "Runway",
    intro: {
      zh: "面向创意团队的视频生成与编辑平台，适合快速探索视觉概念。",
      en: "Video generation and editing platform for creative teams exploring visual concepts quickly."
    },
    category: "Video generation",
    tags: ["video", "creative", "design"],
    scenarios: [scenario("content-generation"), scenario("ui-prototyping")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "需要短视频、分镜或视觉概念草案的内容团队", en: "Content teams that need short videos, storyboards or visual concept drafts" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "商用素材需额外确认授权、肖像与品牌合规。", en: "Commercial use requires extra checks for licence, likeness and brand compliance." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://runwayml.com"
  },
  {
    id: "synthesia",
    source: "listed",
    name: "Synthesia",
    vendor: "Synthesia",
    intro: {
      zh: "企业视频生成平台，常用于培训、产品说明和多语言视频本地化。",
      en: "Enterprise video generation platform commonly used for training, product explainers and multilingual localization."
    },
    category: "Video generation",
    tags: ["video", "avatar", "enterprise"],
    scenarios: [scenario("content-generation"), scenario("customer-support")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "需要稳定生成培训或说明视频的企业团队", en: "Enterprise teams producing training or explainer videos repeatedly" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "使用虚拟人和配音前要确认肖像、语音与地区合规。", en: "Confirm avatar, voice and regional compliance before publishing." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://www.synthesia.io"
  },
  {
    id: "flowise",
    source: "listed",
    name: "Flowise",
    vendor: "Flowise",
    intro: {
      zh: "开源低代码 LLM 编排工具，用可视化节点搭建 RAG、聊天流和 Agent。",
      en: "Open-source low-code LLM orchestration tool for building RAG, chatflows and agents with visual nodes."
    },
    category: "LLM workflow builder",
    tags: ["open-source", "self-host", "rag", "low-code"],
    scenarios: [scenario("workflow-automation"), scenario("knowledge-qa")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "需要快速 PoC LLM 流程但仍想保留自托管路径的团队", en: "Teams that need quick LLM workflow PoCs while keeping a self-hosted path" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "生产化前需补齐认证、密钥隔离和可观测性。", en: "Add auth, secret isolation and observability before production use." }
    ],
    accessTypes: ["local", "cloud", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://flowiseai.com",
    docsUrl: "https://docs.flowiseai.com"
  },
  {
    id: "glean",
    source: "listed",
    name: "Glean",
    vendor: "Glean",
    intro: {
      zh: "企业知识搜索与工作助手，连接公司文档、聊天和业务系统。",
      en: "Enterprise search and work assistant that connects company docs, chat and business systems."
    },
    category: "Enterprise knowledge agent",
    tags: ["enterprise", "search", "knowledge"],
    scenarios: [scenario("knowledge-qa"), scenario("market-research"), scenario("workflow-automation")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "资料分散在多个 SaaS 系统中的中大型组织", en: "Mid-market and enterprise teams with knowledge spread across many SaaS systems" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "接入前要先梳理数据源权限和敏感文档可见性。", en: "Map data-source permissions and sensitive document visibility before rollout." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://www.glean.com"
  },
  {
    id: "ada-ai",
    source: "listed",
    name: "Ada",
    vendor: "Ada",
    intro: {
      zh: "面向客服自动化的 AI 平台，支持多渠道对话和帮助中心接入。",
      en: "Customer-service automation platform with multichannel conversations and help-centre integrations."
    },
    category: "Support agent",
    tags: ["support", "customer-service", "automation"],
    scenarios: [scenario("customer-support"), scenario("knowledge-qa")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "希望把常见问题和客服流程自动化的增长型团队", en: "Growing teams automating common support questions and flows" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "需要先定义转人工规则，避免复杂问题被自动回复卡住。", en: "Define human handoff rules so complex issues do not get stuck in automation." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://www.ada.cx"
  },
  {
    id: "sierra-ai",
    source: "listed",
    name: "Sierra",
    vendor: "Sierra",
    intro: {
      zh: "面向企业客户体验的对话式 AI Agent，强调品牌控制和业务系统动作。",
      en: "Conversational AI agent for enterprise customer experience, emphasizing brand control and business-system actions."
    },
    category: "Customer experience agent",
    tags: ["support", "enterprise", "automation"],
    scenarios: [scenario("customer-support"), scenario("workflow-automation")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "需要把客服对话与订单、账户等后端动作连接的大型团队", en: "Large teams connecting support conversations with order, account or backend actions" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "涉及业务系统动作时必须先设权限边界和人工兜底。", en: "Business-system actions require clear permission boundaries and human fallback." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://sierra.ai"
  },
  {
    id: "lindy",
    source: "listed",
    name: "Lindy",
    vendor: "Lindy",
    intro: {
      zh: "面向普通团队的 AI 员工构建平台，常用于邮件、日程、CRM 更新和重复运营流程。",
      en: "AI employee builder for everyday teams, often used for email, calendar, CRM updates and repetitive operations."
    },
    category: "AI employee builder",
    tags: ["automation", "agent-builder", "operations", "sales"],
    scenarios: [scenario("workflow-automation"), scenario("customer-support"), scenario("knowledge-qa")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "想把邮箱、日程、CRM 里的重复工作交给 AI 员工的团队", en: "Teams that want AI workers for inbox, calendar and CRM chores" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "连接邮箱和 CRM 后会触达真实客户数据，必须先限制权限和审批动作。", en: "Once connected to email and CRM it touches real customer data — limit scopes and approval actions first." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://www.lindy.ai"
  },
  {
    id: "make-ai-agents",
    source: "listed",
    name: "Make AI Agents",
    vendor: "Make",
    intro: {
      zh: "Make 自动化平台内的 AI Agent 能力，适合把 AI 决策接进已有的可视化流程。",
      en: "AI agent capability inside Make's automation platform, useful for adding AI decisions to existing visual workflows."
    },
    category: "Workflow automation",
    tags: ["automation", "make", "workflow", "no-code"],
    scenarios: [scenario("workflow-automation"), scenario("customer-support"), scenario("data-analysis")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "已经用 Make 搭自动化、想加入 AI 判断节点的运营团队", en: "Ops teams already on Make that want AI decision steps in workflows" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "AI 节点可能触发下游副作用，上线前要加人工确认或沙盒场景。", en: "AI steps can trigger downstream side effects — add approval or sandbox scenarios before rollout." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://www.make.com"
  },
  {
    id: "gumloop",
    source: "listed",
    name: "Gumloop",
    vendor: "Gumloop",
    intro: {
      zh: "面向非工程团队的 AI 自动化工作流工具，把网页、表格、文档和模型节点串起来。",
      en: "AI automation workflow tool for non-engineering teams, connecting web, spreadsheets, docs and model nodes."
    },
    category: "AI workflow builder",
    tags: ["automation", "workflow", "no-code", "research"],
    scenarios: [scenario("workflow-automation"), scenario("market-research"), scenario("data-analysis")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "想用拖拽方式把调研、表格和文档处理自动化的团队", en: "Teams that want drag-and-drop automation for research, spreadsheets and document work" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "网页自动化和第三方账号连接需要先确认登录态、权限和速率限制。", en: "Web automation and third-party accounts require careful checks on sessions, permissions and rate limits." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://www.gumloop.com"
  },
  {
    id: "salesforce-agentforce",
    source: "listed",
    name: "Salesforce Agentforce",
    vendor: "Salesforce",
    intro: {
      zh: "Salesforce 生态内的企业 Agent 平台，面向销售、客服、营销和行业流程自动化。",
      en: "Enterprise agent platform inside the Salesforce ecosystem for sales, support, marketing and industry workflows."
    },
    category: "Enterprise agent platform",
    tags: ["salesforce", "crm", "enterprise", "support"],
    scenarios: [scenario("customer-support"), scenario("workflow-automation"), scenario("data-analysis")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "CRM 和客户数据已经在 Salesforce 里的企业", en: "Enterprises whose CRM and customer data already live in Salesforce" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "真实业务动作依赖 Salesforce 权限模型，配置错误会放大自动化风险。", en: "Real business actions depend on Salesforce permissions; misconfiguration amplifies automation risk." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "high",
    hasOnboardingGuide: false,
    officialUrl: "https://www.salesforce.com/agentforce"
  },
  {
    id: "genspark",
    source: "listed",
    name: "Genspark",
    vendor: "Genspark",
    intro: {
      zh: "AI 搜索与研究助手，主打把搜索结果整理成结构化页面和任务型输出。",
      en: "AI search and research assistant focused on turning search results into structured pages and task-oriented outputs."
    },
    category: "AI search",
    tags: ["search", "research", "summaries"],
    scenarios: [scenario("market-research"), scenario("knowledge-qa"), scenario("content-generation")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "需要快速整理资料、生成可分享研究页面的普通用户", en: "Users who need quick research packs and shareable pages" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "重要事实和引用仍需回到原始来源核验。", en: "Important facts and citations still need primary-source verification." }
    ],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://www.genspark.ai"
  },
  {
    id: "notebooklm",
    source: "listed",
    name: "NotebookLM",
    vendor: "Google",
    intro: {
      zh: "Google 的资料笔记和问答工具，适合围绕一组文档做学习、摘要和音频概览。",
      en: "Google's source-grounded notebook and Q&A tool for learning, summarising and generating audio over a document set."
    },
    category: "Knowledge assistant",
    tags: ["google", "notebook", "knowledge", "study"],
    scenarios: [scenario("knowledge-qa"), scenario("content-generation"), scenario("market-research")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "想把 PDF、网页和笔记变成学习问答空间的学生/研究者", en: "Students and researchers turning PDFs, webpages and notes into a study workspace" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "输出主要受你上传资料约束，资料不全时答案也会偏。", en: "Outputs are bounded by supplied sources; incomplete source sets skew answers." }
    ],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://notebooklm.google.com"
  },
  {
    id: "gamma",
    source: "listed",
    name: "Gamma",
    vendor: "Gamma",
    intro: {
      zh: "AI 演示文稿和网页生成工具，适合把大纲快速变成可分享的 deck 或页面。",
      en: "AI presentation and webpage generator for turning outlines into shareable decks or pages quickly."
    },
    category: "Presentation generation",
    tags: ["presentation", "content", "design"],
    scenarios: [scenario("content-generation"), scenario("ui-prototyping")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "需要快速做路演、培训或产品介绍材料的个人和小团队", en: "Individuals and small teams creating pitch, training or product decks quickly" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "视觉结构生成很快，但关键数据和叙事逻辑仍需人工把关。", en: "Visual structure is fast; key data and narrative logic still need human review." }
    ],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://gamma.app"
  },
  {
    id: "canva-magic-studio",
    source: "listed",
    name: "Canva Magic Studio",
    vendor: "Canva",
    intro: {
      zh: "Canva 内置的一组 AI 设计和内容生成工具，适合非设计师快速做海报、社媒图和短视频素材。",
      en: "Canva's AI design and content tools for non-designers making posters, social posts and short-form assets."
    },
    category: "Design assistant",
    tags: ["design", "creative", "content", "image"],
    scenarios: [scenario("content-generation"), scenario("ui-prototyping")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "不会专业设计软件但需要稳定出图的运营/内容团队", en: "Ops and content teams that need reliable visuals without professional design tools" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "模板和素材商用前要确认授权，品牌资产需统一管理。", en: "Check template/asset licences before commercial use and govern brand assets centrally." }
    ],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://www.canva.com/magic"
  },
  {
    id: "vellum-ai",
    source: "listed",
    name: "Vellum",
    vendor: "Vellum AI",
    intro: {
      zh: "面向工程和产品团队的 LLM 应用开发平台，覆盖 prompt 管理、评测、工作流和部署。",
      en: "LLM application platform for product and engineering teams covering prompt management, evals, workflows and deployment."
    },
    category: "LLM app platform",
    tags: ["llmops", "evals", "workflow", "agent-builder"],
    scenarios: [scenario("workflow-automation"), scenario("knowledge-qa"), scenario("data-analysis")],
    unsuitableScenarios: [scenario("content-generation")],
    recommendedFor: [
      { zh: "想把 LLM 应用从 prompt demo 推到可观测生产系统的团队", en: "Teams moving LLM apps from prompt demos into observable production systems" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "平台能力强但需要工程团队维护评测集、版本和回滚策略。", en: "Strong platform, but teams must maintain eval sets, versions and rollback strategy." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://www.vellum.ai"
  },
  {
    id: "relevance-ai",
    source: "listed",
    name: "Relevance AI",
    vendor: "Relevance AI",
    intro: {
      zh: "AI workforce / agent builder 平台，用模板和工具连接搭建销售、运营、研究类 Agent。",
      en: "AI workforce and agent builder platform for assembling sales, operations and research agents with templates and tools."
    },
    category: "AI workforce builder",
    tags: ["agent-builder", "automation", "sales", "research"],
    scenarios: [scenario("workflow-automation"), scenario("market-research"), scenario("customer-support")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "想快速搭建多个岗位型 AI 员工的创业公司和增长团队", en: "Startups and growth teams building several role-based AI workers quickly" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "岗位型 Agent 容易接触客户和销售数据，先从低风险动作开始。", en: "Role-based agents may touch customer and sales data; start with low-risk actions." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://relevanceai.com"
  },
  {
    id: "stack-ai",
    source: "listed",
    name: "Stack AI",
    vendor: "Stack AI",
    intro: {
      zh: "企业 AI Agent 和工作流构建平台，常用于把内部知识、表格、API 和审批流程串起来。",
      en: "Enterprise AI agent and workflow builder for connecting internal knowledge, spreadsheets, APIs and approval flows."
    },
    category: "Enterprise agent builder",
    tags: ["agent-builder", "enterprise", "workflow", "knowledge"],
    scenarios: [scenario("workflow-automation"), scenario("knowledge-qa"), scenario("data-analysis")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "需要把内部流程做成可控 AI 应用的运营、销售和数据团队", en: "Ops, sales and data teams turning internal processes into controlled AI apps" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "连接企业知识库和业务 API 前，需要先确认权限、日志和审批边界。", en: "Before connecting knowledge bases and business APIs, verify permissions, logs and approval boundaries." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://www.stack-ai.com"
  },
  {
    id: "relay-app",
    source: "listed",
    name: "Relay.app",
    vendor: "Relay.app",
    intro: {
      zh: "面向团队协作的自动化工具，强调人工审批、AI 步骤和 SaaS 流程编排。",
      en: "Team automation tool focused on human approvals, AI steps and SaaS workflow orchestration."
    },
    category: "Workflow automation",
    tags: ["automation", "approval", "workflow", "no-code"],
    scenarios: [scenario("workflow-automation"), scenario("customer-support"), scenario("content-generation")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "想让 AI 参与流程但仍保留人工确认的业务团队", en: "Business teams that want AI in workflows while keeping human approval" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "适合从审批型流程开始，不建议一开始就让 AI 自动执行不可逆动作。", en: "Start with approval-driven workflows rather than irreversible autonomous actions." }
    ],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://www.relay.app"
  },
  {
    id: "chatbase",
    source: "listed",
    name: "Chatbase",
    vendor: "Chatbase",
    intro: {
      zh: "把网站、文档和知识库变成客服/问答聊天机器人的工具，适合快速上线低门槛 AI 客服。",
      en: "Tool for turning websites, docs and knowledge bases into support or Q&A chatbots."
    },
    category: "Support chatbot builder",
    tags: ["chatbot", "support", "knowledge", "no-code"],
    scenarios: [scenario("customer-support"), scenario("knowledge-qa")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "希望快速给官网、帮助中心或产品文档加问答入口的小团队", en: "Small teams adding Q&A to websites, help centers or product docs quickly" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "上线前要测试幻觉、拒答和转人工规则，避免客服口径失控。", en: "Test hallucinations, refusals and handoff rules before exposing it to customers." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://www.chatbase.co"
  },
  {
    id: "dust",
    source: "listed",
    name: "Dust",
    vendor: "Dust",
    intro: {
      zh: "企业内部 AI 助手和 Agent 平台，面向知识检索、团队工作流和公司数据连接。",
      en: "Enterprise AI assistant and agent platform for knowledge retrieval, team workflows and company data connectors."
    },
    category: "Enterprise knowledge agent",
    tags: ["enterprise", "knowledge", "workflow", "assistant"],
    scenarios: [scenario("knowledge-qa"), scenario("workflow-automation"), scenario("market-research")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "想给不同团队配置内部 AI 助手并接入公司数据源的组织", en: "Organizations configuring internal AI assistants across teams and data sources" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "企业内部分发前必须确认数据源 ACL、敏感字段和审计日志。", en: "Before internal rollout, confirm source ACLs, sensitive fields and audit logs." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://dust.tt"
  },
  {
    id: "poe",
    source: "listed",
    name: "Poe",
    vendor: "Quora",
    intro: {
      zh: "多模型聊天与 Bot 平台，普通用户可以集中试用不同模型，也可以创建轻量 Bot。",
      en: "Multi-model chat and bot platform where users can try different models and create lightweight bots."
    },
    category: "Multi-model bot platform",
    tags: ["chat", "multi-model", "bot", "consumer"],
    scenarios: [scenario("knowledge-qa"), scenario("content-generation"), scenario("multimodal-chat")],
    unsuitableScenarios: [scenario("workflow-automation")],
    recommendedFor: [
      { zh: "想低门槛比较多个模型、做轻量问答 Bot 的普通用户", en: "Consumers comparing models or creating lightweight Q&A bots with low setup" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "不同 Bot 的能力和来源差异很大，重要结论需要看清模型和资料来源。", en: "Bot quality and provenance vary widely; check model and source context for important conclusions." }
    ],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://poe.com"
  },
  {
    id: "zapier-interfaces-chatbots",
    source: "listed",
    name: "Zapier Interfaces & Chatbots",
    vendor: "Zapier",
    intro: {
      zh: "Zapier 的表单、页面和聊天机器人能力，适合把自动化流程包装成给客户或内部团队使用的小入口。",
      en: "Zapier's forms, pages and chatbot surfaces for packaging automations into small customer or internal tools."
    },
    category: "No-code AI front end",
    tags: ["zapier", "chatbot", "automation", "no-code"],
    scenarios: [scenario("workflow-automation"), scenario("customer-support"), scenario("knowledge-qa")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "已经用 Zapier 自动化，希望给流程加一个简单网页/聊天入口的团队", en: "Teams already using Zapier that need a simple web or chat front end for workflows" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "入口越像产品，越需要补权限、错误提示、日志和人工兜底。", en: "The more product-like the surface, the more it needs permissions, error handling, logs and fallback." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://zapier.com/interfaces"
  },
  {
    id: "claude",
    source: "listed",
    name: "Claude",
    vendor: "Anthropic",
    intro: {
      zh: "Anthropic 的通用 AI 助手与 API，适合长文分析、写作、代码理解和复杂推理任务。",
      en: "Anthropic's general AI assistant and API for long-form analysis, writing, code understanding and complex reasoning."
    },
    category: "General assistant",
    tags: ["claude", "anthropic", "general", "coding", "writing", "reasoning"],
    scenarios: [scenario("knowledge-qa"), scenario("content-generation"), scenario("developer-assistant"), scenario("market-research")],
    unsuitableScenarios: [scenario("defi-trading")],
    recommendedFor: [
      { zh: "需要稳定处理长文档、方案分析和代码解释的个人或团队", en: "Individuals or teams that need dependable long-document, planning and code-analysis work" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "云端助手/API 会处理用户输入，敏感资料应先脱敏并遵守企业数据策略。", en: "The hosted assistant/API processes user inputs; sanitize sensitive data and follow company data policy." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://claude.ai/",
    docsUrl: "https://platform.claude.com/docs/en/home",
    pricingHint: {
      zh: "Web 端订阅与 API 用量计费并行，具体以 Anthropic 当前价格为准。",
      en: "Web subscriptions and usage-based API pricing coexist; confirm current Anthropic pricing before rollout."
    },
    latestObservedAt: "2026-06-12",
    observationSummary: {
      zh: "已按官方文档收录为通用 AI 助手/API；平台尚未做独立审计。",
      en: "Listed from official docs as a general AI assistant/API; no independent platform audit yet."
    }
  },
  {
    id: "deepseek",
    source: "listed",
    name: "DeepSeek",
    vendor: "DeepSeek",
    intro: {
      zh: "面向普通用户和开发者的中文友好大模型助手与 OpenAI 兼容 API，适合问答、推理、代码和低成本模型接入。",
      en: "Chinese-friendly assistant and OpenAI-compatible API for Q&A, reasoning, coding and cost-sensitive model integration."
    },
    category: "General assistant",
    tags: ["deepseek", "深度求索", "reasoning", "coding", "openai-compatible", "china"],
    scenarios: [scenario("knowledge-qa"), scenario("developer-assistant"), scenario("content-generation"), scenario("data-analysis")],
    unsuitableScenarios: [scenario("defi-trading")],
    recommendedFor: [
      { zh: "希望低成本接入推理/代码模型，且中文需求较多的个人和开发者", en: "Users and developers with Chinese-heavy reasoning or coding needs and cost sensitivity" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "不同入口的数据策略、可用性和模型版本可能不同，企业接入前要核对隐私与稳定性要求。", en: "Data policy, availability and model versions may vary by entry point; verify privacy and stability before enterprise use." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://www.deepseek.com/en/",
    docsUrl: "https://api-docs.deepseek.com/",
    pricingHint: {
      zh: "Web 端可直接试用；API 按平台当前模型价格和用量计费。",
      en: "Web access is available; API cost depends on current model pricing and usage."
    },
    latestObservedAt: "2026-06-12",
    observationSummary: {
      zh: "已按官网和 API 文档收录为通用助手/API；平台尚未做独立审计。",
      en: "Listed from official site and API docs as a general assistant/API; no independent platform audit yet."
    }
  },
  {
    id: "kimi",
    source: "listed",
    name: "Kimi",
    vendor: "Moonshot AI",
    intro: {
      zh: "Moonshot AI 的中文友好长上下文助手与 API，适合文档阅读、资料整理、研究问答和长文本处理。",
      en: "Moonshot AI's Chinese-friendly long-context assistant and API for document reading, research Q&A and long-text work."
    },
    category: "Long-context assistant",
    tags: ["kimi", "moonshot", "月之暗面", "long-context", "research", "chinese"],
    scenarios: [scenario("knowledge-qa"), scenario("market-research"), scenario("content-generation"), scenario("data-analysis")],
    unsuitableScenarios: [scenario("defi-trading")],
    recommendedFor: [
      { zh: "经常读长 PDF、网页资料、会议纪要和中文研究材料的用户", en: "Users who often process long PDFs, webpages, meeting notes and Chinese research materials" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "长上下文并不等于事实可靠，重要结论仍需回到来源核验。", en: "Long context is not the same as factual certainty; verify important conclusions against sources." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://www.kimi.com/",
    docsUrl: "https://platform.kimi.ai/docs",
    pricingHint: {
      zh: "Web 与 API 双入口；API 成本取决于模型、上下文长度和用量。",
      en: "Web and API access; API cost depends on model, context length and usage."
    },
    latestObservedAt: "2026-06-12",
    observationSummary: {
      zh: "已按 Moonshot/Kimi 官方入口收录为长上下文助手/API；平台尚未做独立审计。",
      en: "Listed from Moonshot/Kimi official entry points as a long-context assistant/API; no independent platform audit yet."
    }
  },
  {
    id: "qwen-agent",
    source: "listed",
    name: "Qwen / Qwen Agent",
    vendor: "Alibaba Cloud",
    intro: {
      zh: "阿里 Qwen 系列的聊天入口、模型 API 与开源 Agent 框架，覆盖普通问答、工具调用、规划和自定义助手开发。",
      en: "Alibaba Qwen's chat entry, model API and open-source agent framework for Q&A, tool use, planning and custom assistants."
    },
    category: "Model and agent framework",
    tags: ["qwen", "通义千问", "qwen-agent", "tool-use", "open-source", "chinese", "agent-framework"],
    scenarios: [scenario("knowledge-qa"), scenario("developer-assistant"), scenario("workflow-automation"), scenario("multimodal-chat")],
    unsuitableScenarios: [scenario("defi-trading")],
    recommendedFor: [
      { zh: "想同时评估中文模型、开源权重和 Agent 开发框架的开发者", en: "Developers evaluating Chinese models, open weights and an agent framework together" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "自建 Agent 需要自行处理工具权限、日志、密钥和外部动作审批。", en: "Custom agents require your own controls for tool permissions, logs, secrets and action approvals." }
    ],
    accessTypes: ["saas", "api", "local"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://qwen.ai/",
    docsUrl: "https://qwenlm.github.io/Qwen-Agent/en/",
    pricingHint: {
      zh: "聊天入口、API 与开源框架并行；实际成本取决于托管方式和模型用量。",
      en: "Chat, API and open-source framework paths coexist; cost depends on hosting path and model usage."
    },
    latestObservedAt: "2026-06-12",
    observationSummary: {
      zh: "已按 Qwen 官方入口与 Qwen-Agent 文档收录；平台尚未做独立审计。",
      en: "Listed from Qwen official entry and Qwen-Agent docs; no independent platform audit yet."
    }
  },
  {
    id: "coze",
    source: "listed",
    name: "Coze",
    vendor: "ByteDance / Coze",
    intro: {
      zh: "无代码/低代码 AI Agent 应用开发平台，支持构建 Agent 并发布到 Web、API 和多种渠道。",
      en: "No-code/low-code AI agent app platform for building agents and publishing them to web, APIs and channels."
    },
    category: "Agent builder",
    tags: ["coze", "扣子", "agent-builder", "no-code", "bot", "workflow", "websdk"],
    scenarios: [scenario("workflow-automation"), scenario("knowledge-qa"), scenario("customer-support"), scenario("content-generation")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "想快速做一个可发布 Bot/Agent，但还不想自己写后端的个人或小团队", en: "Individuals or small teams that want to publish a bot/agent quickly without building a backend" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "发布到外部渠道前，需要确认知识库权限、用户输入留存和工具动作边界。", en: "Before publishing to channels, verify knowledge-base permissions, input retention and tool-action boundaries." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://www.coze.com/",
    docsUrl: "https://www.coze.com/open/docs/guides/quickstart",
    pricingHint: {
      zh: "以平台当前套餐、模型调用和发布渠道计费为准。",
      en: "Cost depends on current plans, model usage and publishing channels."
    },
    latestObservedAt: "2026-06-12",
    observationSummary: {
      zh: "已按 Coze 官网和 Quickstart 文档收录为 Agent 构建平台；平台尚未做独立审计。",
      en: "Listed from Coze site and quickstart docs as an agent builder; no independent platform audit yet."
    }
  },
  {
    id: "browser-use",
    source: "listed",
    name: "Browser Use",
    vendor: "Browser Use",
    intro: {
      zh: "面向 AI Agent 的浏览器自动化工具/API，让模型在真实网页上执行浏览、点击、表单和跨站任务。",
      en: "Browser automation tool/API for AI agents, letting models browse, click, fill forms and complete web tasks."
    },
    category: "Browser automation",
    tags: ["browser-use", "browser", "automation", "web-agent", "open-source", "api", "computer-use"],
    scenarios: [scenario("workflow-automation"), scenario("market-research"), scenario("developer-assistant")],
    unsuitableScenarios: [scenario("defi-trading")],
    recommendedFor: [
      { zh: "需要让 Agent 操作网页、跑网页任务或做浏览器自动化验证的开发者", en: "Developers who need agents to operate websites, run web tasks or test browser workflows" }
    ],
    riskLevel: "high",
    riskNotes: [
      { zh: "浏览器自动化可能触达登录态、表单提交、付款和账号操作，必须先限制权限并保留人工确认。", en: "Browser automation can touch sessions, forms, purchases and account actions; restrict permissions and keep human approval first." }
    ],
    riskMitigation: [
      { zh: "优先使用测试账号、隔离浏览器配置和白名单域名，避免直接连接真实高价值账户。", en: "Prefer test accounts, isolated browser profiles and allowlisted domains before connecting high-value accounts." }
    ],
    accessTypes: ["local", "api", "cloud"],
    complexity: "high",
    hasOnboardingGuide: false,
    officialUrl: "https://browser-use.com/",
    docsUrl: "https://github.com/browser-use/browser-use",
    pricingHint: {
      zh: "开源本地路径与托管/API 路径并行；成本取决于部署方式、浏览器会话和模型用量。",
      en: "Open-source local and hosted/API paths coexist; cost depends on deployment, browser sessions and model usage."
    },
    latestObservedAt: "2026-06-12",
    observationSummary: {
      zh: "已按官网和 GitHub Quickstart 收录为浏览器自动化 Agent 基础设施；平台尚未做独立审计。",
      en: "Listed from official site and GitHub quickstart as browser automation infrastructure for agents; no independent platform audit yet."
    }
  },
  {
    id: "composio",
    source: "listed",
    name: "Composio",
    vendor: "Composio",
    intro: {
      zh: "面向 AI Agent 的工具集成和授权平台，帮助 Agent 连接 Slack、Gmail、Notion、GitHub 等大量业务工具。",
      en: "Tool integration and auth platform for AI agents, connecting agents to apps like Slack, Gmail, Notion and GitHub."
    },
    category: "Agent tool integration",
    tags: ["composio", "toolkits", "mcp", "oauth", "integration", "agent-tools", "auth"],
    scenarios: [scenario("workflow-automation"), scenario("developer-assistant"), scenario("customer-support"), scenario("knowledge-qa")],
    unsuitableScenarios: [scenario("content-generation")],
    recommendedFor: [
      { zh: "已经有 Agent 框架，但缺少安全授权和第三方工具连接的开发者团队", en: "Developer teams that already have an agent framework but need secure auth and third-party tool connections" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "工具集成层会管理第三方授权，必须检查 OAuth 范围、撤权路径和每个工具的操作日志。", en: "The integration layer manages third-party auth; check OAuth scopes, revocation paths and per-tool action logs." }
    ],
    accessTypes: ["api", "cloud"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://composio.dev/",
    docsUrl: "https://docs.composio.dev/",
    pricingHint: {
      zh: "按平台当前工具包、会话、团队和用量策略计费。",
      en: "Cost depends on current toolkit, session, team and usage policies."
    },
    latestObservedAt: "2026-06-12",
    observationSummary: {
      zh: "已按 Composio 官网和文档收录为 Agent 工具集成层；平台尚未做独立审计。",
      en: "Listed from Composio site and docs as an agent tool integration layer; no independent platform audit yet."
    }
  }
];
