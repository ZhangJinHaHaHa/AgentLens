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
    hasOnboardingGuide: false,
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
    id: "perplexity",
    source: "listed",
    name: "Perplexity",
    vendor: "Perplexity AI",
    intro: {
      zh: "对话式搜索与研究助手，会附带可点击的引用来源。",
      en: "Conversational search and research assistant with inline source citations."
    },
    category: "Research assistant",
    tags: ["search", "research", "rag"],
    scenarios: [scenario("market-research"), scenario("knowledge-qa"), scenario("content-generation")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "需要带引用的快速调研", en: "Quick research with traceable citations" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "答案质量依赖网络索引质量，重要决策仍需人核。", en: "Answer quality depends on the live index — verify critical claims yourself." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://www.perplexity.ai"
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
    id: "intercom-fin",
    source: "listed",
    name: "Intercom Fin",
    vendor: "Intercom",
    intro: {
      zh: "面向客服场景的 AI agent，可以接入帮助中心数据自动答客户问题。",
      en: "Customer-support AI agent that ingests help-centre data and answers user questions automatically."
    },
    category: "Support agent",
    tags: ["support", "intercom", "knowledge"],
    scenarios: [scenario("customer-support"), scenario("knowledge-qa")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "客服量大但希望保持品牌口吻的团队", en: "Support teams with high volume that want to keep brand voice" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "回答质量与帮助中心一致性强相关，需要先做内容治理。", en: "Answer quality tracks help-centre quality — invest in content governance first." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://www.intercom.com/fin"
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
    hasOnboardingGuide: false,
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
    hasOnboardingGuide: false,
    officialUrl: "https://n8n.io"
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
    id: "midjourney",
    source: "listed",
    name: "Midjourney",
    vendor: "Midjourney",
    intro: {
      zh: "高质量图像生成模型，目前主要通过 Discord / Web 入口使用。",
      en: "High-quality image generation model accessed primarily through Discord / Web."
    },
    category: "Image generation",
    tags: ["image", "design"],
    scenarios: [scenario("content-generation"), scenario("ui-prototyping")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "需要快速出风格化视觉素材的团队", en: "Teams that need stylised visual assets fast" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "商用前需阅读授权条款。", en: "Read the licence terms before commercial use." }
    ],
    accessTypes: ["saas", "browser_ext"],
    complexity: "low",
    hasOnboardingGuide: false,
    officialUrl: "https://www.midjourney.com"
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
    hasOnboardingGuide: false,
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
      zh: "通用任务型 Agent，2024 末期声量较高，定位为“跑腿型 Agent”。",
      en: "General-purpose task agent — gained traction in late 2024 as an 'errand agent'."
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
    hasOnboardingGuide: false,
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
    hasOnboardingGuide: false,
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
    id: "dify",
    source: "listed",
    name: "Dify",
    vendor: "Dify",
    intro: {
      zh: "开源 LLM 应用开发平台，支持 RAG、工作流和 Agent 编排，可自托管。",
      en: "Open-source LLM app platform for RAG, workflows and agent orchestration, with self-hosting support."
    },
    category: "LLM app platform",
    tags: ["open-source", "self-host", "rag", "workflow"],
    scenarios: [scenario("workflow-automation"), scenario("knowledge-qa"), scenario("data-analysis")],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "希望用低代码方式搭建内部 AI 应用的工程团队", en: "Engineering teams building internal AI apps with low-code controls" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "自托管时需要自行维护模型、密钥和知识库权限。", en: "Self-hosted deployments must manage models, secrets and knowledge-base permissions." }
    ],
    accessTypes: ["local", "cloud", "api"],
    complexity: "medium",
    hasOnboardingGuide: false,
    officialUrl: "https://dify.ai",
    docsUrl: "https://docs.dify.ai"
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
  }
];
