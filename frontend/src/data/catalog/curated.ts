import type { AgentCatalogEntry } from "@/domain/catalog";

import { scenario } from "./scenarios";

/**
 * Editorial set — official/popular agents we actively maintain.
 *
 * Each entry must include both zh / en copy for every I18nText field. The
 * `validateCatalog` script enforces this at build time. When you add a new
 * curated agent, also drop a matching file under `data/catalog/onboarding/`.
 */
export const curatedAgents: AgentCatalogEntry[] = [
  {
    id: "claude-code",
    source: "curated",
    name: "Claude Code",
    vendor: "Anthropic",
    intro: {
      zh: "Anthropic 官方的终端 / IDE 编码 Agent，擅长在真实仓库内做长链路改动，并保留可审计的工具调用记录。",
      en: "Anthropic's terminal/IDE coding agent designed for long-running edits inside real repositories with auditable tool traces."
    },
    tagline: {
      zh: "适合做“整段需求一次跑完”的研发助手",
      en: "Designed for end-to-end tasks rather than autocomplete"
    },
    category: "Coding agent",
    tags: ["coding", "anthropic", "terminal", "ide"],
    scenarios: [
      scenario("developer-assistant"),
      scenario("agentic-coding"),
      scenario("ide-coding")
    ],
    unsuitableScenarios: [
      scenario("customer-support"),
      scenario("content-generation")
    ],
    recommendedFor: [
      { zh: "希望把整段研发任务一次跑完的小型团队", en: "Small teams that want a single agent to land a feature end-to-end" },
      { zh: "重视工具调用透明度的审慎团队", en: "Teams that value transparent tool-call traces" },
      { zh: "Claude 已是首选模型的工程组", en: "Engineering orgs that already standardise on Claude" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "授予仓库写权限时需要先审定许可范围。", en: "Repository write access must be scoped before granting." },
      { zh: "长任务会消耗较多 token，需提前预算。", en: "Long-horizon tasks consume more tokens — budget ahead." }
    ],
    riskMitigation: [
      { zh: "用 sandbox/branch 模式跑，再提交合并。", en: "Run in sandbox/branch mode, then merge after review." },
      { zh: "为模型配置审计日志和 max_tokens 上限。", en: "Wire audit logging and max_tokens limits before scaling." }
    ],
    accessTypes: ["cli", "api", "saas"],
    complexity: "medium",
    hasOnboardingGuide: true,
    officialUrl: "https://www.anthropic.com/claude-code",
    docsUrl: "https://docs.claude.com/claude-code",
    pricingHint: {
      zh: "按 Claude API token 计费；订阅版另有打包价。",
      en: "Pay-as-you-go via Claude API tokens; bundled pricing on subscription tiers."
    },
    pricingUrl: "https://www.anthropic.com/pricing",
    latestObservedAt: "2025-04-12",
    observationSummary: {
      zh: "近一个月内大幅扩展了工具调用列表与权限管理面板。",
      en: "Tool catalogue and permission console expanded significantly in the past month."
    }
  },
  {
    id: "codex",
    source: "curated",
    name: "Codex",
    vendor: "OpenAI",
    intro: {
      zh: "OpenAI 的代码任务 Agent，适合把“读仓库、改代码、跑测试、解释 diff”这类研发任务接到平台代码工作区。",
      en: "OpenAI's coding task agent, suited for repo reading, code edits, test runs, and diff explanations inside a platform code workspace."
    },
    tagline: {
      zh: "手机端发起代码任务，云端沙箱执行和留痕",
      en: "Start coding tasks on mobile, execute them in a cloud sandbox"
    },
    category: "Coding agent",
    tags: ["coding", "openai", "codex", "cli", "repo", "sandbox"],
    scenarios: [
      scenario("agentic-coding"),
      scenario("developer-assistant"),
      scenario("ide-coding")
    ],
    unsuitableScenarios: [
      scenario("customer-support"),
      scenario("content-generation")
    ],
    recommendedFor: [
      { zh: "希望用 OpenAI 模型承接代码任务的团队", en: "Teams that want OpenAI models to handle coding tasks" },
      { zh: "需要在手机上发起、云端完成代码修改的用户", en: "Users who start code work on mobile and finish it in the cloud" },
      { zh: "想把代码执行、测试和审计记录放进平台闭环的开发者", en: "Developers who want execution, tests, and audit logs inside the platform loop" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "代码 Agent 需要仓库和文件权限，不能默认直接改主分支。", en: "Coding agents need repo and file access and should not edit main branches by default." },
      { zh: "API 调用不等于官方 ChatGPT / Codex 客户端的全部体验。", en: "API use is not the full official ChatGPT or Codex client experience." }
    ],
    riskMitigation: [
      { zh: "先接代码沙箱、临时分支、diff 预览和测试日志。", en: "Connect code sandboxing, temporary branches, diff preview, and test logs first." },
      { zh: "所有写入动作默认人工确认。", en: "Require human confirmation for every write action by default." }
    ],
    accessTypes: ["cli", "api", "cloud"],
    complexity: "medium",
    hasOnboardingGuide: true,
    officialUrl: "https://openai.com/codex",
    docsUrl: "https://developers.openai.com/codex/",
    pricingHint: {
      zh: "平台先走中转站模型额度；接官方 OpenAI Key 后可切换到官方工具链与更强模型能力。",
      en: "AgentLens can use the relay model balance first; once official OpenAI keys are connected, it can switch to the official toolchain and stronger model capabilities."
    },
    pricingUrl: "https://openai.com/pricing",
    latestObservedAt: "2026-06-21",
    observationSummary: {
      zh: "作为代码工作区核心候选，当前按“平台沙箱 + OpenAI 模型/SDK”路径接入。",
      en: "Core candidate for the code workspace, currently modeled as a platform sandbox plus OpenAI model/SDK route."
    }
  },
  {
    id: "cursor",
    source: "curated",
    name: "Cursor",
    vendor: "Cursor (Anysphere)",
    intro: {
      zh: "围绕 VS Code 内核打造的 AI IDE，主打“在编辑器里直接和代码对话”，对中型仓库的多文件改动支持成熟。",
      en: "An AI-native IDE forked from VS Code that emphasises conversing with your code in-editor and handles multi-file edits well."
    },
    tagline: {
      zh: "已是工程师群体最熟悉的 AI IDE 之一",
      en: "Among the most familiar AI IDEs in shipping teams"
    },
    category: "AI IDE",
    tags: ["ide", "vscode", "coding", "team"],
    scenarios: [
      scenario("ide-coding"),
      scenario("developer-assistant"),
      scenario("agentic-coding")
    ],
    unsuitableScenarios: [
      scenario("customer-support"),
      scenario("workflow-automation")
    ],
    recommendedFor: [
      { zh: "已经在用 VS Code、想原地升级的团队", en: "Teams already on VS Code who want an in-place upgrade" },
      { zh: "希望沿用现有插件生态的工程师", en: "Engineers that want to keep their existing extensions" },
      { zh: "需要团队级共享 prompt / rule 的中小公司", en: "Mid-sized orgs that want team-level prompt/rule sharing" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "默认会上传项目片段到云端，敏感仓库需要打开 Privacy Mode。", en: "Code snippets ship to the cloud by default — enable Privacy Mode for sensitive repos." }
    ],
    riskMitigation: [
      { zh: "对 monorepo 启用 .cursorignore，并打开 Privacy Mode。", en: "Maintain .cursorignore for monorepos and enable Privacy Mode." }
    ],
    accessTypes: ["local", "saas"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://cursor.com",
    docsUrl: "https://docs.cursor.com",
    pricingHint: {
      zh: "免费层 + Pro 订阅，团队版按席位计费。",
      en: "Free tier + Pro subscription; team tier per-seat."
    },
    pricingUrl: "https://cursor.com/pricing",
    latestObservedAt: "2025-04-22",
    observationSummary: {
      zh: "新增了 Background Agents 与多分支并行执行能力。",
      en: "Background Agents and parallel branch execution shipped recently."
    }
  },
  {
    id: "openai-gpt5",
    source: "curated",
    name: "ChatGPT (GPT-5 family)",
    vendor: "OpenAI",
    intro: {
      zh: "OpenAI 的旗舰对话模型，叠加了文件分析、代码解释、网页浏览和工具调用；适合做通用知识工作助手。",
      en: "OpenAI's flagship conversational model with file analysis, code interpreter, browsing and tool use — a general-purpose knowledge worker assistant."
    },
    tagline: {
      zh: "不用打开 ChatGPT，直接在手机工作区完成写作、分析和代码解释",
      en: "Write, analyse, and explain code from your phone workspace — no need to open ChatGPT"
    },
    category: "General assistant",
    tags: ["llm", "openai", "general", "multimodal"],
    scenarios: [
      scenario("knowledge-qa"),
      scenario("content-generation"),
      scenario("market-research"),
      scenario("multimodal-chat")
    ],
    unsuitableScenarios: [
      scenario("defi-trading"),
      scenario("devops-sre")
    ],
    recommendedFor: [
      { zh: "需要一个通用助手覆盖写作 / 分析 / 搜索的个人或小团队", en: "Individuals and small teams that want one assistant for writing, analysis and search" },
      { zh: "需要图像 + 文字混合输入的场景", en: "Workflows that mix images and text" },
      { zh: "正在评估“从 ChatGPT 起步再迁移”路径的团队", en: "Teams evaluating a 'start with ChatGPT, migrate later' path" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "默认会用对话内容做 anonymized 研究，企业版可关闭。", en: "By default conversations may be used for anonymised research — opt-out via Enterprise." },
      { zh: "工具调用产生的浏览/代码执行行为需要再做一层人审。", en: "Browsing and code execution still need a human review pass." }
    ],
    accessTypes: ["saas", "api", "browser_ext"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://chat.openai.com",
    docsUrl: "https://platform.openai.com/docs",
    pricingHint: {
      zh: "免费 + Plus / Team / Enterprise 订阅；API 按 token 计费。",
      en: "Free + Plus/Team/Enterprise; API priced per token."
    },
    pricingUrl: "https://openai.com/pricing",
    latestObservedAt: "2025-04-30",
    observationSummary: {
      zh: "Project / Memory 功能进一步整合，支持跨对话记住偏好。",
      en: "Projects + Memory deepened — preferences now persist across chats."
    },
    capabilityContract: {
      mapFit: "main",
      inputTypes: ["text", "image", "file", "url"],
      outputTypes: ["text", "report", "table", "file"],
      requiredTools: ["model", "web-search", "web-fetch", "file-parser"],
      runtimeMode: "model-gateway",
      mobileSupport: "full",
      desktopSupport: "full",
      permissionNeeds: [],
      pricingMode: "per-token",
      trustSignals: ["audit", "sample-output"],
      knownLimits: [
        { zh: "通过平台模型网关运行，不等同于官方 ChatGPT 全部功能（如 Projects / Memory）。", en: "Runs via the platform model gateway; not equivalent to the full ChatGPT product including Projects and Memory." }
      ],
      typicalTasks: [
        { zh: "分析或总结一份文件", en: "Analyse or summarise a document" },
        { zh: "帮我写一份报告草稿", en: "Draft a report for me" },
        { zh: "搜索并整理一个话题", en: "Research and organise a topic" }
      ]
    }
  },
  {
    id: "meeting-digest",
    source: "curated",
    name: "MeetingDigest",
    vendor: "AgentLens",
    intro: {
      zh: "面向普通用户的会议和邮件整理 Agent：把会议记录、访谈稿或邮件串整理成摘要、决议、行动项表格和待确认问题。",
      en: "A meeting and email digest Agent for everyday users: turns notes, interview transcripts, or email threads into summaries, decisions, action tables, and open questions."
    },
    tagline: {
      zh: "把一堆会议/邮件文本变成能直接推进的行动清单",
      en: "Turns messy meeting or email text into an action-ready checklist"
    },
    category: "Productivity assistant",
    tags: ["meeting", "email", "productivity", "summary", "action-items", "model-gateway"],
    scenarios: [
      scenario("workflow-automation"),
      scenario("knowledge-qa"),
      scenario("content-generation")
    ],
    unsuitableScenarios: [
      scenario("defi-trading"),
      scenario("ide-coding")
    ],
    recommendedFor: [
      { zh: "会议很多、但没人专门做纪要和跟进的小团队", en: "Small teams with many meetings but no dedicated note-taker" },
      { zh: "需要把客户访谈、内部讨论整理成行动项的产品/运营同事", en: "Product and ops teammates turning interviews or discussions into action items" },
      { zh: "想在手机上粘贴一段聊天/邮件就拿到结构化结果的非技术用户", en: "Non-technical users who want structured output from pasted chat or email text on the phone" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "当前只处理用户粘贴或平台传入的文本，不会自动读取邮箱、日历或录音。", en: "Currently processes only pasted or platform-provided text; it does not automatically read email, calendars, or recordings." },
      { zh: "如果原文没有负责人、截止日期或上下文，行动项会标成待确认。", en: "If the source lacks owners, deadlines, or context, action items are marked as to-confirm." }
    ],
    riskMitigation: [
      { zh: "先用非敏感会议记录测试输出格式，再接企业邮箱或录音转写。", en: "Start with non-sensitive notes before connecting enterprise email or audio transcription." },
      { zh: "把自动发送、建日历、推送通知等写入动作放到后续权限确认层。", en: "Keep writes such as sending emails, creating calendar events, or pushing notifications behind a later permission layer." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://agentlens.local/meeting-digest",
    docsUrl: "https://agentlens.local/meeting-digest",
    pricingHint: {
      zh: "平台模型网关按所选模型扣积分；上线初期优先走平台余额。",
      en: "Charged through the platform model gateway by the selected model; early versions use AgentLens credits."
    },
    latestObservedAt: "2026-06-22",
    observationSummary: {
      zh: "平台自营第一批模型网关 Agent，用来验证“手机端直接使用垂类 Agent 能力”的货架闭环。",
      en: "First self-operated model-gateway Agent used to validate the shelf loop for mobile-first vertical Agent capability."
    },
    capabilityContract: {
      mapFit: "main",
      inputTypes: ["text"],
      outputTypes: ["text", "report", "table"],
      requiredTools: ["model", "audit-log"],
      runtimeMode: "model-gateway",
      mobileSupport: "full",
      desktopSupport: "full",
      permissionNeeds: [],
      pricingMode: "per-token",
      trustSignals: ["audit", "sample-output"],
      knownLimits: [
        { zh: "当前不会自动读取邮箱、日历、录音或企业知识库，只处理用户粘贴/上传给平台的文本。", en: "Currently does not automatically read email, calendars, recordings, or enterprise knowledge bases; it only processes text supplied to AgentLens." }
      ],
      typicalTasks: [
        { zh: "整理会议纪要并生成待办表", en: "Summarise meeting notes into an action table" },
        { zh: "从邮件串提取负责人和截止时间", en: "Extract owners and deadlines from an email thread" },
        { zh: "把访谈记录整理成决议和待确认问题", en: "Turn an interview transcript into decisions and open questions" }
      ]
    }
  },
  {
    id: "docsgpt",
    source: "curated",
    name: "DocsGPT",
    vendor: "DocsGPT / AgentLens",
    intro: {
      zh: "面向资料问答的开源 Agent：用户上传文档或粘贴资料后，可以直接追问、总结和提取依据，结果带来源与运行记录。",
      en: "An open-source document Q&A Agent: upload or paste material, then ask questions, summarise, and extract evidence with sources and run traces."
    },
    tagline: {
      zh: "把一份资料变成能追问的知识助手",
      en: "Turn documents into a question-answering assistant"
    },
    buyerCard: {
      tasks: [
        { zh: "上传资料后问重点", en: "Ask key questions after uploading a document" },
        { zh: "从文档中提取依据", en: "Extract evidence from documents" },
        { zh: "整理成摘要或清单", en: "Turn material into summaries or lists" }
      ],
      deliverable: {
        zh: "基于上传资料的答案、摘要、来源和积分记录。",
        en: "Answers, summaries, sources, and credit records based on uploaded material."
      },
      notFor: {
        zh: "不适合替代完整企业知识库后台、爬虫系统或长期向量库管理。",
        en: "Not a replacement for a full enterprise knowledge-base admin, crawler, or long-lived vector-store system."
      },
      runMode: {
        zh: "平台托管 DocsGPT 兼容资料问答运行器，用户用平台积分运行。",
        en: "Runs through an AgentLens-hosted DocsGPT-compatible document Q&A runner and charges platform credits."
      },
      dataBoundary: {
        zh: "首版只处理用户主动上传到工作区的临时文件；不会自动读取网盘、邮箱或企业知识库。",
        en: "First version only handles temporary files users upload to the workspace; it does not automatically read drives, email, or enterprise knowledge bases."
      },
      differentiation: {
        zh: "比普通聊天多了文件入口、来源留痕、积分结算和可复核的运行记录。",
        en: "Adds file intake, source evidence, credit settlement, and reviewable run traces on top of plain chat."
      }
    },
    category: "Document Q&A agent",
    tags: ["docs", "rag", "knowledge", "qa", "file", "open-source", "external-adapter"],
    scenarios: [
      scenario("knowledge-qa"),
      scenario("content-generation"),
      scenario("data-analysis")
    ],
    unsuitableScenarios: [
      scenario("defi-trading"),
      scenario("ide-coding")
    ],
    recommendedFor: [
      { zh: "想把 PDF、Markdown、会议资料快速变成问答助手的普通用户", en: "Users who want PDFs, Markdown, or meeting material to become a Q&A assistant quickly" },
      { zh: "需要在手机上上传资料并追问重点的小团队", en: "Small teams that need to upload documents and ask follow-up questions from mobile" },
      { zh: "希望先验证资料问答，再扩展到长期知识库的团队", en: "Teams that want to validate document Q&A before expanding into persistent knowledge bases" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "答案质量取决于上传资料质量和可提取文本质量。", en: "Answer quality depends on the uploaded material and extractable text quality." },
      { zh: "首版临时文件不等同于长期知识库，不能默认保留企业资料。", en: "First-version temporary files are not a persistent knowledge base and should not retain enterprise documents by default." }
    ],
    riskMitigation: [
      { zh: "默认走临时文件通道，输出显示来源和运行记录。", en: "Use a temporary-file channel by default, with sources and run traces in the output." },
      { zh: "长期知识库、爬虫和企业权限后续再做独立授权。", en: "Long-lived knowledge bases, crawlers, and enterprise permissions need later dedicated authorization." }
    ],
    accessTypes: ["local", "cloud", "api"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://github.com/arc53/DocsGPT",
    docsUrl: "https://docs.docsgpt.cloud",
    pricingHint: {
      zh: "平台按文件问答运行和模型消耗折算积分；接官方模型 key 后可提升理解和引用质量。",
      en: "AgentLens meters document Q&A runs and model usage as credits; official model keys can improve reasoning and citation quality later."
    },
    pricingUrl: "https://github.com/arc53/DocsGPT",
    latestObservedAt: "2026-06-23",
    observationSummary: {
      zh: "已作为第一批真实可运行工作区 Agent 接入：上传临时文件、问答、来源和扣积分链路已通过 smoke。",
      en: "Connected as a first-batch runnable workspace Agent: temporary file upload, Q&A, sources, and credit charging have passed smoke validation."
    },
    capabilityContract: {
      mapFit: "main",
      inputTypes: ["text", "file"],
      outputTypes: ["text", "report", "table"],
      requiredTools: ["model", "file-parser", "audit-log"],
      runtimeMode: "external-adapter",
      mobileSupport: "full",
      desktopSupport: "full",
      permissionNeeds: ["file-access"],
      pricingMode: "per-run",
      trustSignals: ["audit", "sample-output"],
      knownLimits: [
        { zh: "当前是 AgentLens 托管的 DocsGPT 兼容运行器，不是完整 DocsGPT 管理后台。", en: "This is an AgentLens-hosted DocsGPT-compatible runner, not the full DocsGPT admin product." },
        { zh: "首版主要支持已能提取文本的资料；复杂扫描件、图片 OCR 和长期知识库仍需后续扩展。", en: "First version focuses on text-extractable documents; scanned files, image OCR, and persistent knowledge bases need later expansion." }
      ],
      typicalTasks: [
        { zh: "上传一份产品说明，提取三条用户价值", en: "Upload a product note and extract three user values" },
        { zh: "根据会议资料回答一个细节问题", en: "Answer a detail question from meeting material" },
        { zh: "把一段资料整理成摘要和待办清单", en: "Turn material into a summary and action list" }
      ],
      moduleNarratives: [
        {
          id: "files_knowledge",
          status: "ready",
          label: { zh: "文件 / 资料问答", en: "Files / document Q&A" },
          description: {
            zh: "临时文件上传、资料问答、来源返回和积分扣减已经接入平台工作区。",
            en: "Temporary file upload, document Q&A, source return, and credit charging are connected in the workspace."
          },
          caveats: [
            {
              zh: "这是临时资料问答，不是长期企业知识库后台。",
              en: "This is temporary document Q&A, not a long-lived enterprise knowledge-base admin."
            }
          ],
          testPrompt: {
            zh: "上传一份资料，问它最重要的三条结论。",
            en: "Upload a document and ask for its three most important conclusions."
          }
        },
        {
          id: "api_connector",
          status: "ready",
          label: { zh: "API 连接器", en: "API connector" },
          description: {
            zh: "DocsGPT 兼容运行器由平台服务端托管，前端只拿工作区文件引用，不暴露模型或运行器凭证。",
            en: "The DocsGPT-compatible runner is hosted server-side; the frontend only receives workspace file references, not model or runner credentials."
          }
        },
        {
          id: "audit_metering",
          status: "ready",
          label: { zh: "积分 / 运行记录", en: "Credits / run trace" },
          description: {
            zh: "文件接收、模型调用、最终回答和积分扣减会写入 Workspace Run。",
            en: "File intake, model calls, final answers, and credit charges are written into Workspace Run records."
          }
        }
      ]
    },
    demoVideos: [
      {
        title: {
          zh: "手机上传资料并追问重点",
          en: "Upload a document on mobile and ask follow-ups"
        },
        summary: {
          zh: "演示用户在平台工作区上传资料，DocsGPT 返回摘要、依据来源和运行记录。",
          en: "Shows a user uploading material in the workspace and receiving a summary, evidence sources, and run trace."
        },
        status: "planned",
        durationLabel: { zh: "约 1 分钟", en: "About 1 min" },
        transcript: [
          { zh: "选择 DocsGPT，上传一份资料。", en: "Choose DocsGPT and upload a document." },
          { zh: "输入问题或点击典型任务。", en: "Ask a question or tap a typical task." },
          { zh: "结果返回答案、来源和积分记录。", en: "The answer returns with sources and credit records." }
        ]
      }
    ]
  },
  {
    id: "gpt-researcher",
    source: "curated",
    name: "深度调研助手",
    vendor: "GPT Researcher / AgentLens",
    intro: {
      zh: "AgentLens 托管的深度调研助手，基于 GPT Researcher 开源项目：用户输入一个问题，平台自动联网搜索、筛选资料并生成带来源的研究报告。",
      en: "A hosted deep-research assistant powered by the open-source GPT Researcher project: give it a question and AgentLens searches the web, reviews sources, and returns a cited report."
    },
    tagline: {
      zh: "输入一个问题，拿到带来源的调研简报",
      en: "Ask one question and get a sourced research brief"
    },
    buyerCard: {
      tasks: [
        { zh: "调研一个行业机会", en: "Research an industry opportunity" },
        { zh: "整理竞品和用户痛点", en: "Summarise competitors and user pain points" },
        { zh: "生成带来源的简报", en: "Generate a sourced brief" }
      ],
      deliverable: {
        zh: "带来源、结论和不确定性的研究报告。",
        en: "A research report with sources, conclusions, and uncertainty notes."
      },
      notFor: {
        zh: "不适合直接替代法律、投资或医疗等专业尽调。",
        en: "Not a replacement for professional legal, investment, or medical diligence."
      },
      runMode: {
        zh: "平台托管运行 GPT Researcher 适配器，用户用平台积分发起调研。",
        en: "Runs through AgentLens' hosted GPT Researcher adapter and charges platform credits."
      },
      dataBoundary: {
        zh: "首版只做只读网页调研，不登录账号、不提交表单、不写入外部系统。",
        en: "First version is read-only web research: no account login, form submission, or external writes."
      },
      differentiation: {
        zh: "比普通聊天多了搜索、来源整理、运行记录和统一积分结算。",
        en: "Adds search, source review, run traces, and unified credits on top of plain chat."
      }
    },
    category: "Research assistant",
    tags: ["research", "search", "citations", "report", "open-source", "external-adapter"],
    scenarios: [
      scenario("market-research"),
      scenario("knowledge-qa"),
      scenario("data-analysis")
    ],
    unsuitableScenarios: [
      scenario("defi-trading"),
      scenario("ide-coding")
    ],
    recommendedFor: [
      { zh: "需要快速整理市场、竞品、行业资料的普通用户", en: "Users who need quick market, competitor, or industry briefs" },
      { zh: "希望把搜索、筛选和报告留成可复核记录的团队", en: "Teams that want search, review, and reporting captured as a trace" },
      { zh: "想在手机上发起调研任务、稍后拿报告的人", en: "People who want to start research on mobile and receive a report later" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "联网调研会受到搜索质量、网页可访问性和来源时效影响。", en: "Web research depends on search quality, page availability, and source freshness." },
      { zh: "报告里的结论需要复核来源，不能替代专业尽调或投资建议。", en: "Report conclusions still need source review and do not replace professional diligence or investment advice." }
    ],
    riskMitigation: [
      { zh: "报告显示来源和不确定性，平台保留搜索与生成 trace。", en: "Reports show sources and uncertainty, while AgentLens keeps search and generation traces." },
      { zh: "先以只读网页调研运行，后续再逐步开放账号登录、文件和写入权限。", en: "Start with read-only web research, then later graduate to account login, files, and writes." }
    ],
    accessTypes: ["cloud", "api"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://github.com/assafelovic/gpt-researcher",
    docsUrl: "https://docs.gptr.dev/docs/gpt-researcher/getting-started",
    pricingHint: {
      zh: "首版按调研深度、搜索次数和模型消耗折算平台积分；接通官方模型 key 后可提升搜索和写作质量。",
      en: "First version charges platform credits by research depth, search volume, and model usage; official model keys can improve search and writing quality later."
    },
    pricingUrl: "https://docs.gptr.dev/docs/gpt-researcher/getting-started",
    latestObservedAt: "2026-06-22",
    observationSummary: {
      zh: "第一批 external_adapter 接入对象；买家看到的是深度调研助手，技术来源为 GPT Researcher 开源项目。",
      en: "First-batch external_adapter integration; buyers see Deep Research, technically powered by GPT Researcher."
    },
    capabilityContract: {
      mapFit: "main",
      inputTypes: ["text", "url"],
      outputTypes: ["report", "text"],
      requiredTools: ["model", "web-search", "web-fetch", "audit-log"],
      runtimeMode: "external-adapter",
      mobileSupport: "full",
      desktopSupport: "full",
      permissionNeeds: [],
      pricingMode: "per-run",
      trustSignals: ["audit", "sample-output"],
      knownLimits: [
        { zh: "当前只承诺只读网页调研；需要登录、付费墙或私有数据库的任务会被标为边界外。", en: "Currently only read-only web research is promised; login, paywalled, or private-database tasks are out of scope." },
        { zh: "如果搜索源质量不足，报告会提示不确定性，而不是假装已经完成专业尽调。", en: "If source quality is weak, the report should state uncertainty instead of pretending to complete professional diligence." }
      ],
      typicalTasks: [
        { zh: "调研中国跨境电商卖家 2026 年最关心的三个 AI 工具场景", en: "Research the top three AI tool scenarios for Chinese cross-border e-commerce sellers in 2026" },
        { zh: "比较三款竞品并列出证据来源", en: "Compare three competitors and list the evidence sources" },
        { zh: "整理一个行业机会的 5 条结论和引用链接", en: "Summarise five findings and citation links for an industry opportunity" }
      ]
    },
    demoVideos: [
      {
        title: {
          zh: "手机上发起一份带来源的行业调研",
          en: "Start a sourced industry brief on mobile"
        },
        summary: {
          zh: "演示用户在平台工作区输入调研问题，深度调研助手返回来源、结论和不确定性说明。",
          en: "Shows a user entering a research question in the workspace and receiving sources, findings, and uncertainty notes."
        },
        status: "planned",
        durationLabel: { zh: "约 1 分钟", en: "About 1 min" },
        transcript: [
          { zh: "选择 Deep Research，输入调研问题。", en: "Choose Deep Research and enter a research question." },
          { zh: "平台联网搜索并记录来源。", en: "AgentLens searches the web and records sources." },
          { zh: "结果以简报形式返回，可继续追问或保存 trace。", en: "The result returns as a brief; users can follow up or save the trace." }
        ]
      }
    ]
  },
  {
    id: "browser-use-readonly",
    source: "curated",
    name: "网页信息采集",
    vendor: "Browser Use / AgentLens",
    intro: {
      zh: "AgentLens 托管的只读网页采集 Agent，基于 Browser Use 思路：用户给出任务后，平台打开公开网页、读取内容、截图或整理来源，再把结果带回工作区。",
      en: "A hosted read-only web collection agent inspired by Browser Use: give it a task and AgentLens opens public pages, reads content, captures evidence, and returns sources to the workspace."
    },
    tagline: {
      zh: "让 Agent 替你读公开网页，但不替你登录或提交",
      en: "Let an Agent read public webpages, without logging in or submitting anything"
    },
    buyerCard: {
      tasks: [
        { zh: "整理公开网页价格信息", en: "Collect public pricing pages" },
        { zh: "提取竞品页面卖点", en: "Extract competitor page claims" },
        { zh: "把多个页面整理成来源清单", en: "Turn several pages into a source list" }
      ],
      deliverable: {
        zh: "公开网页摘要、来源链接、可复核的浏览 trace。",
        en: "Public-page summaries, source links, and a reviewable browsing trace."
      },
      notFor: {
        zh: "不适合登录后台、提交表单、下单付款、发布消息或上传文件。",
        en: "Not for signing in, submitting forms, purchasing, posting messages, or uploading files."
      },
      runMode: {
        zh: "平台托管只读 Browser Use 适配器，用户用平台积分发起网页采集。",
        en: "Runs through AgentLens' hosted read-only Browser Use adapter and charges platform credits."
      },
      dataBoundary: {
        zh: "首版只访问公开网页；不接用户浏览器登录态，不写入外部系统。",
        en: "First version only accesses public webpages; it does not use the user's logged-in browser session or write to external systems."
      },
      differentiation: {
        zh: "比普通搜索多了打开页面、读取内容、保留来源和运行记录。",
        en: "Adds page opening, content reading, sources, and run traces on top of plain search."
      }
    },
    category: "Web research agent",
    tags: ["browser", "web", "sources", "read-only", "external-adapter"],
    scenarios: [
      scenario("market-research"),
      scenario("knowledge-qa"),
      scenario("workflow-automation")
    ],
    unsuitableScenarios: [
      scenario("defi-trading"),
      scenario("ide-coding")
    ],
    recommendedFor: [
      { zh: "想让平台替自己读取多个公开网页的普通用户", en: "Users who want AgentLens to read several public pages for them" },
      { zh: "需要保留来源和浏览步骤的运营、市场和销售团队", en: "Marketing, sales, and operations teams that need sources and browsing steps" },
      { zh: "想先看只读自动化效果，再逐步开放账号权限的团队", en: "Teams that want read-only automation before granting account permissions" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "网页结构变化、反爬限制或访问失败会影响采集结果。", en: "Page layout changes, anti-bot controls, and access failures can affect results." },
      { zh: "首版不使用用户登录态，因此看不到登录后页面或私有后台。", en: "The first version does not use user login state, so it cannot view logged-in or private pages." }
    ],
    riskMitigation: [
      { zh: "只读模式默认拒绝登录、提交表单、购买、上传和发消息类任务。", en: "Read-only mode rejects login, form submission, purchase, upload, and posting tasks by default." },
      { zh: "输出保留来源链接和运行记录，方便人工复核。", en: "Outputs include source links and run traces for human review." }
    ],
    accessTypes: ["cloud", "api"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://github.com/browser-use/browser-use",
    docsUrl: "https://docs.browser-use.com",
    pricingHint: {
      zh: "首版按网页采集次数、页面读取量和模型消耗折算平台积分。",
      en: "First version charges platform credits by browsing run, page reads, and model usage."
    },
    pricingUrl: "https://docs.browser-use.com",
    latestObservedAt: "2026-06-22",
    observationSummary: {
      zh: "第二批 external_adapter 接入对象；当前先做只读公开网页采集，写入类浏览器动作全部阻断。",
      en: "Second external_adapter integration; starts with read-only public web collection and blocks all browser write actions."
    },
    capabilityContract: {
      mapFit: "browser",
      inputTypes: ["text", "url"],
      outputTypes: ["report", "text", "table"],
      requiredTools: ["browser", "web-search", "web-fetch", "audit-log"],
      runtimeMode: "external-adapter",
      mobileSupport: "full",
      desktopSupport: "full",
      permissionNeeds: [],
      pricingMode: "per-run",
      trustSignals: ["audit", "sample-output"],
      knownLimits: [
        { zh: "首版不接登录态，不处理需要账号权限、验证码或付费墙的页面。", en: "First version does not use login state and cannot handle account-only, CAPTCHA, or paywalled pages." },
        { zh: "不会提交表单、发消息、下单、付款、上传文件或修改权限。", en: "It will not submit forms, post messages, place orders, pay, upload files, or change permissions." }
      ],
      typicalTasks: [
        { zh: "打开三个公开价格页，整理套餐差异和来源", en: "Open three public pricing pages and summarise plan differences with sources" },
        { zh: "读取竞品首页和功能页，提取主要卖点", en: "Read competitor home and feature pages to extract key claims" },
        { zh: "把多个网页整理成一份可复核资料包", en: "Turn several webpages into a reviewable evidence pack" }
      ]
    },
    demoVideos: [
      {
        title: {
          zh: "手机上发起一次公开网页采集",
          en: "Start a public web collection run on mobile"
        },
        summary: {
          zh: "演示用户输入网页采集任务，平台读取公开页面并返回摘要、来源和运行记录。",
          en: "Shows a user asking for web collection and receiving summaries, sources, and a trace."
        },
        status: "planned",
        durationLabel: { zh: "约 1 分钟", en: "About 1 min" },
        transcript: [
          { zh: "选择网页信息采集，输入公开网页任务。", en: "Choose Web Info Collector and enter a public web task." },
          { zh: "平台只读打开网页并记录来源。", en: "AgentLens opens pages in read-only mode and records sources." },
          { zh: "结果回到工作区，写入类动作会被阻断。", en: "Results return to the workspace; write actions are blocked." }
        ]
      }
    ]
  },
  {
    id: "v0",
    source: "curated",
    name: "v0 by Vercel",
    vendor: "Vercel",
    intro: {
      zh: "Vercel 出品的 UI / 全栈原型生成 Agent，输入一段需求即返回可部署的 Next.js + Tailwind 代码，强项是 UI 交付速度。",
      en: "Vercel's UI/full-stack prototyping agent that turns a prompt into deployable Next.js + Tailwind code — its strength is UI throughput."
    },
    category: "UI prototyping",
    tags: ["ui", "nextjs", "tailwind", "prototype"],
    scenarios: [
      scenario("ui-prototyping"),
      scenario("fullstack-prototyping"),
      scenario("content-generation")
    ],
    unsuitableScenarios: [
      scenario("defi-trading"),
      scenario("devops-sre")
    ],
    recommendedFor: [
      { zh: "需要在一两个小时内出可演示原型的团队", en: "Teams that need a demonstrable prototype within an hour or two" },
      { zh: "已经选用 Vercel + Next.js 栈的项目", en: "Projects already on Vercel + Next.js" },
      { zh: "把视觉同事拉进来就能改前端的小团队", en: "Small teams whose designers iterate on the front-end directly" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "生成代码偶有过期 API 用法，需做一次升级回归。", en: "Generated code occasionally uses outdated APIs — bring it through a code review." }
    ],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://v0.dev",
    docsUrl: "https://v0.dev/docs",
    pricingHint: {
      zh: "免费层 + Pro / Team 订阅，按 message / 部署量计费。",
      en: "Free tier + Pro/Team plans, scaled by messages and deployments."
    },
    pricingUrl: "https://v0.dev/pricing",
    latestObservedAt: "2025-04-18",
    observationSummary: {
      zh: "新增了 v0-1.5 模型与多文件项目模式。",
      en: "v0-1.5 model and multi-file project mode shipped."
    }
  },
  {
    id: "lovable",
    source: "curated",
    name: "Lovable",
    vendor: "Lovable",
    intro: {
      zh: "面向非技术创始人的全栈应用 Agent：通过自然语言迭代出可部署的 React + Supabase 应用。",
      en: "A full-stack app builder targeted at non-technical founders — iterate in natural language and ship a React + Supabase app."
    },
    category: "Full-stack app builder",
    tags: ["nocode", "react", "supabase", "founder"],
    scenarios: [
      scenario("fullstack-prototyping"),
      scenario("ui-prototyping"),
      scenario("workflow-automation")
    ],
    unsuitableScenarios: [
      scenario("devops-sre"),
      scenario("data-analysis")
    ],
    recommendedFor: [
      { zh: "想自己做 MVP 验证想法的非技术创始人", en: "Non-technical founders validating an MVP themselves" },
      { zh: "需要快速做内部工具的运营 / 产品同事", en: "Ops / product folks who need a quick internal tool" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "复杂业务逻辑超出生成模板时，仍需自行接手代码。", en: "Once business logic exceeds the templates you'll have to hand-take the code." },
      { zh: "默认存储在 Supabase 上，要先评估数据合规。", en: "Defaults to Supabase storage — evaluate data compliance first." }
    ],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://lovable.dev",
    docsUrl: "https://docs.lovable.dev",
    pricingHint: {
      zh: "免费层 + Starter / Pro 订阅，按生成次数计费。",
      en: "Free tier + Starter/Pro plans, metered by generations."
    },
    pricingUrl: "https://lovable.dev/pricing",
    latestObservedAt: "2025-04-09",
    observationSummary: {
      zh: "上线了多人协作模式与 Supabase 项目导入。",
      en: "Multiplayer collaboration and Supabase project import shipped."
    }
  },
  {
    id: "devin",
    source: "curated",
    name: "Devin",
    vendor: "Cognition AI",
    intro: {
      zh: "Cognition 出品的“自主软件工程师”Agent，能在沙盒中规划、写码、运行测试并提交 PR，定位是把整段任务托管出去。",
      en: "Cognition's autonomous software-engineer agent — plans, codes, runs tests and opens PRs inside a sandbox. Positioned as 'hand off the whole task'."
    },
    category: "Autonomous engineer",
    tags: ["autonomous", "engineering", "sandbox", "pr"],
    scenarios: [
      scenario("agentic-coding"),
      scenario("developer-assistant"),
      scenario("workflow-automation")
    ],
    unsuitableScenarios: [
      scenario("ide-coding"),
      scenario("customer-support")
    ],
    recommendedFor: [
      { zh: "想把重复型 backlog 任务批量委托的工程组", en: "Engineering orgs that want to delegate repetitive backlog work" },
      { zh: "已经有清晰任务模板与验收标准的团队", en: "Teams with crisp task templates and acceptance criteria" }
    ],
    riskLevel: "high",
    riskNotes: [
      { zh: "长任务执行成本高，需要提前定义停止条件。", en: "Long-horizon runs are expensive — define hard stop conditions up front." },
      { zh: "必须配合人审 + 受限沙盒使用。", en: "Must be paired with human review and a restricted sandbox." }
    ],
    riskMitigation: [
      { zh: "在 staging 仓库内运行，并强制 PR 审批。", en: "Run against a staging repo and require PR approval." },
      { zh: "对外部网络访问设白名单。", en: "Restrict outbound network access via allowlist." }
    ],
    accessTypes: ["saas", "cloud"],
    complexity: "high",
    hasOnboardingGuide: true,
    officialUrl: "https://devin.ai",
    docsUrl: "https://docs.devin.ai",
    pricingHint: {
      zh: "按席位 + 计算量订阅，企业版另议。",
      en: "Per-seat + compute subscription; enterprise pricing on request."
    },
    pricingUrl: "https://devin.ai/pricing",
    latestObservedAt: "2025-04-05",
    observationSummary: {
      zh: "Devin 2.0 大幅压低了任务单价并发布团队仪表盘。",
      en: "Devin 2.0 cut per-task pricing and shipped a team dashboard."
    }
  },
  {
    id: "replit-agent",
    source: "curated",
    name: "Replit Agent",
    vendor: "Replit",
    intro: {
      zh: "Replit 内置的全栈 Agent，结合在线 IDE 与一键部署，从想法到上线的链路最短。",
      en: "Replit's built-in full-stack agent paired with the online IDE and one-click deploy — shortest path from idea to running URL."
    },
    category: "Full-stack agent",
    tags: ["replit", "ide", "deploy", "fullstack"],
    scenarios: [
      scenario("fullstack-prototyping"),
      scenario("ui-prototyping"),
      scenario("developer-assistant")
    ],
    unsuitableScenarios: [
      scenario("defi-trading"),
      scenario("devops-sre")
    ],
    recommendedFor: [
      { zh: "想边写边发布原型的独立开发者", en: "Solo developers who want to ship while they iterate" },
      { zh: "用浏览器就能完成端到端开发的教育 / hackathon 场景", en: "Education / hackathon scenarios where everything happens in the browser" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "默认在 Replit 云端运行，敏感数据需要走自部署版本。", en: "Runs on Replit's cloud by default — sensitive data requires self-hosted." }
    ],
    accessTypes: ["saas", "cloud"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://replit.com/agent",
    docsUrl: "https://docs.replit.com/replit-agent",
    pricingHint: {
      zh: "Replit Core 订阅内附 Agent 配额，按使用量增购。",
      en: "Bundled with Replit Core subscription, pay-as-you-go above quota."
    },
    pricingUrl: "https://replit.com/pricing",
    latestObservedAt: "2025-04-11",
    observationSummary: {
      zh: "Agent v2 引入了更稳的多文件编辑和错误修复循环。",
      en: "Agent v2 ships steadier multi-file editing and an error repair loop."
    }
  },
  {
    id: "bolt-new",
    source: "curated",
    name: "Bolt.new",
    vendor: "StackBlitz",
    intro: {
      zh: "StackBlitz 出品的浏览器内全栈 Agent，强项是 Node.js + Vite 项目的“在 WebContainer 里直接运行”。",
      en: "StackBlitz's in-browser full-stack agent — its edge is running Node.js + Vite projects inside WebContainer with zero setup."
    },
    category: "Browser full-stack",
    tags: ["webcontainer", "vite", "node", "fullstack"],
    scenarios: [
      scenario("fullstack-prototyping"),
      scenario("ui-prototyping"),
      scenario("developer-assistant")
    ],
    unsuitableScenarios: [
      scenario("defi-trading"),
      scenario("devops-sre")
    ],
    recommendedFor: [
      { zh: "想跑 Node 全栈但又不想本地装环境的开发者", en: "Developers who want a Node full-stack environment without local setup" },
      { zh: "做 demo / 工作坊的演讲者", en: "Speakers running live demos or workshops" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "WebContainer 仍有部分原生模块不支持，复杂依赖需要预先确认。", en: "WebContainer still skips some native modules — verify heavy deps up front." }
    ],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://bolt.new",
    docsUrl: "https://stackblitz.com/docs",
    pricingHint: {
      zh: "免费层 + 按对话量计费的订阅。",
      en: "Free tier + subscriptions metered by chats."
    },
    pricingUrl: "https://stackblitz.com/pricing",
    latestObservedAt: "2025-03-30",
    observationSummary: {
      zh: "新增了 GitHub 集成与团队协作模式。",
      en: "GitHub integration and team collab mode shipped."
    }
  },
  {
    id: "continue-dev",
    source: "curated",
    name: "Continue",
    vendor: "Continue.dev",
    intro: {
      zh: "开源、可自托管的 IDE AI 助手，可接 OpenAI / Anthropic / 本地模型，是“想自己掌控模型与数据”的团队的默认选择。",
      en: "Open-source, self-hostable IDE AI assistant. Bring your own OpenAI/Anthropic/local model — the default for teams that want to own the model and data."
    },
    category: "Open-source IDE assistant",
    tags: ["open-source", "ide", "self-host", "byom"],
    scenarios: [
      scenario("ide-coding"),
      scenario("developer-assistant")
    ],
    unsuitableScenarios: [
      scenario("customer-support"),
      scenario("content-generation")
    ],
    recommendedFor: [
      { zh: "希望把对话与代码留在内部网络的团队", en: "Teams that want chats and code to stay inside their network" },
      { zh: "想要可自定义 prompt / model 路由的工程组", en: "Engineering orgs that want custom prompt/model routing" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "自部署版本对模型质量和资源管控负责。", en: "Self-hosting puts the burden of model quality and resource control on you." }
    ],
    accessTypes: ["local", "api", "cloud"],
    complexity: "medium",
    hasOnboardingGuide: true,
    officialUrl: "https://continue.dev",
    docsUrl: "https://docs.continue.dev",
    pricingHint: {
      zh: "开源免费；模型成本由你自己承担。",
      en: "Open-source free; model spend is on you."
    },
    pricingUrl: "https://continue.dev",
    latestObservedAt: "2025-04-02",
    observationSummary: {
      zh: "v1.0 稳定版发布，配置文件升级到 hub.continue.dev。",
      en: "v1.0 stable shipped — config now hosts on hub.continue.dev."
    }
  },
  {
    id: "openhands",
    source: "curated",
    name: "OpenHands",
    vendor: "All Hands AI",
    intro: {
      zh: "OpenHands（前 OpenDevin）是开源的自主工程 Agent，定位与 Devin 接近但完全可自托管。",
      en: "OpenHands (formerly OpenDevin) is the open-source autonomous engineering agent — Devin-shaped but self-hostable."
    },
    category: "Open-source autonomous engineer",
    tags: ["autonomous", "open-source", "self-host", "engineering"],
    scenarios: [
      scenario("agentic-coding"),
      scenario("developer-assistant"),
      scenario("workflow-automation")
    ],
    unsuitableScenarios: [
      scenario("ide-coding"),
      scenario("customer-support")
    ],
    recommendedFor: [
      { zh: "想要自托管 Devin 替代品的工程团队", en: "Engineering teams that want a self-hosted Devin alternative" },
      { zh: "做研究 / 离线评估 Agent 的实验室", en: "Research labs that need offline-evaluated agents" }
    ],
    riskLevel: "high",
    riskNotes: [
      { zh: "默认会启动一个 Docker 沙盒，需提前评估资源边界。", en: "Spins up a Docker sandbox by default — vet your resource boundaries first." },
      { zh: "复杂任务的成功率比商业版仍有差距，需保留人审。", en: "Success rate on hard tasks still trails commercial offerings — keep a human in the loop." }
    ],
    riskMitigation: [
      { zh: "在 staging 集群里跑，限制网络访问和 GPU 配额。", en: "Run inside a staging cluster, with restricted network and GPU quotas." },
      { zh: "所有 PR 强制人审。", en: "Mandatory human review on every PR." }
    ],
    accessTypes: ["local", "cloud", "api"],
    complexity: "high",
    hasOnboardingGuide: true,
    officialUrl: "https://github.com/All-Hands-AI/OpenHands",
    docsUrl: "https://docs.all-hands.dev",
    pricingHint: {
      zh: "项目本身开源免费；模型与计算成本由你承担。",
      en: "Project itself is open-source free; model + compute spend is yours."
    },
    pricingUrl: "https://docs.all-hands.dev",
    latestObservedAt: "2025-04-08",
    observationSummary: {
      zh: "OpenHands v0.20 发布，强化了多 Agent 协作和评估管线。",
      en: "OpenHands v0.20 shipped with stronger multi-agent collab and an evaluation pipeline."
    }
  },
  {
    id: "aider",
    source: "curated",
    name: "Aider",
    vendor: "Aider",
    intro: {
      zh: "命令行下的 git 友好型 AI pair programmer，特别适合在已有仓库内做小步、可回滚的代码改动。",
      en: "A git-friendly AI pair programmer in your terminal — small, revertable edits in existing repos."
    },
    category: "Terminal pair programmer",
    tags: ["cli", "git", "pair-programming"],
    scenarios: [
      scenario("ide-coding"),
      scenario("developer-assistant")
    ],
    unsuitableScenarios: [
      scenario("ui-prototyping"),
      scenario("customer-support")
    ],
    recommendedFor: [
      { zh: "重视 git 历史可回溯的工程师", en: "Engineers who care about git-traceable history" },
      { zh: "想在终端里完成日常修改的极客", en: "Terminal-first engineers who prefer the CLI for daily edits" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "默认会自动 git commit，需提前理解工作流。", en: "Auto git commits by default — learn the workflow before letting it loose." }
    ],
    accessTypes: ["cli", "api"],
    complexity: "medium",
    hasOnboardingGuide: true,
    officialUrl: "https://aider.chat",
    docsUrl: "https://aider.chat/docs",
    pricingHint: {
      zh: "工具开源免费；模型成本按所选 provider 计费。",
      en: "Tool is free and open-source; model spend depends on the provider."
    },
    pricingUrl: "https://aider.chat/docs/llms.html",
    latestObservedAt: "2025-04-15",
    observationSummary: {
      zh: "新增 architect 模式与 repo 索引并行处理。",
      en: "Architect mode and parallel repo indexing landed."
    }
  },
  {
    id: "dify",
    source: "curated",
    name: "Dify",
    vendor: "Dify",
    intro: {
      zh: "开源 LLM 应用开发平台，支持 RAG、工作流和 Agent 编排，可自托管。30 分钟内可以跑通第一个智能应用。",
      en: "Open-source LLM app platform for RAG, workflows and agent orchestration with self-hosting support. First app running in 30 minutes."
    },
    tagline: {
      zh: "把知识库和工作流搬进手机，不用登录 Dify 后台",
      en: "Run Dify knowledge bases and workflows from your phone — no Dify console login needed"
    },
    category: "LLM app platform",
    tags: ["open-source", "self-host", "rag", "workflow"],
    scenarios: [
      scenario("workflow-automation"),
      scenario("knowledge-qa"),
      scenario("data-analysis")
    ],
    unsuitableScenarios: [scenario("ide-coding")],
    recommendedFor: [
      { zh: "希望用低代码方式搭建内部 RAG 和 Agent 应用的工程团队", en: "Engineering teams building internal RAG and agent apps with low-code controls" },
      { zh: "有自托管要求、不想把数据推给第三方的企业", en: "Enterprises that need self-hosting and want to keep data in-house" },
      { zh: "需要对接多个 LLM Provider 并支持快速切换的平台", en: "Platforms that need multi-LLM-provider support with easy switching" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "自托管时需要自行维护模型、密钥和知识库权限。", en: "Self-hosted deployments must manage models, secrets and knowledge-base permissions." },
      { zh: "知识库分块策略影响 RAG 质量，默认设置需要按场景调优。", en: "Chunk strategy directly affects RAG quality — default settings need per-use-case tuning." }
    ],
    riskMitigation: [
      { zh: "用 Secrets Manager 或 .env 隔离 API Key，不要硬编码在应用配置中。", en: "Use a secrets manager or .env to isolate API keys — never hardcode them in app config." },
      { zh: "先在云端版验证流程，再迁移到自托管。", en: "Validate the workflow on cloud first, then migrate to self-hosted." }
    ],
    accessTypes: ["local", "cloud", "api"],
    complexity: "medium",
    hasOnboardingGuide: true,
    officialUrl: "https://dify.ai",
    docsUrl: "https://docs.dify.ai",
    pricingHint: {
      zh: "开源版免费自托管；云端版有免费额度，付费版按用量计费。",
      en: "Open-source self-hosting is free; cloud tier has a free quota with usage-based paid plans."
    },
    pricingUrl: "https://dify.ai/pricing",
    capabilityContract: {
      mapFit: "workflow",
      inputTypes: ["text", "file", "url"],
      outputTypes: ["text", "report", "workflow", "file"],
      requiredTools: ["model", "file-parser", "workflow-api"],
      runtimeMode: "external-adapter",
      mobileSupport: "partial",
      desktopSupport: "full",
      permissionNeeds: ["file-access"],
      pricingMode: "per-run",
      trustSignals: ["audit", "sample-output"],
      knownLimits: [
        { zh: "手机工作区运行的是平台托管适配器，不等同于完整 Dify Studio 后台。", en: "The mobile workspace runs the AgentLens hosted adapter, not the full Dify Studio console." },
        { zh: "持久写入、官方账号权限和自托管管理动作仍需要用户确认。", en: "Persistent writes, official account permissions, and self-hosted admin actions still require user confirmation." }
      ],
      typicalTasks: [
        { zh: "创建知识库并上传资料", en: "Create a knowledge base and upload documents" },
        { zh: "运行工作流并查看执行结果", en: "Run a workflow and view the execution result" },
        { zh: "搭建一个 RAG 问答应用", en: "Build a RAG Q&A application" }
      ],
      moduleNarratives: [
        {
          id: "files_knowledge",
          status: "ready",
          label: { zh: "文件 / 知识库", en: "Files / knowledge" },
          description: {
            zh: "Dify 文件输入计划、服务端文件上传、知识库创建、文本资料写入和文档读取已经接入工作区验收台。",
            en: "Dify file plans, server-side file upload, knowledge-base creation, text document writes, and document reads are connected in the workspace console."
          },
          caveats: [
            {
              zh: "长期写入仍需要用户确认；Dify Cloud Studio 原生 App 创建/发布需要官方账号或自托管 admin 权限。",
              en: "Persistent writes still need user confirmation; native Dify Cloud Studio app creation/publishing needs official account or self-hosted admin access."
            }
          ],
          testPrompt: {
            zh: "创建知识库，写入一段手机端资料，再读取文档状态。",
            en: "Create a knowledge base, write a mobile note, then read document status."
          }
        },
        {
          id: "workflow_tools",
          status: "testable",
          label: { zh: "工作流 / 工具", en: "Workflow / tools" },
          description: {
            zh: "Dify 工作区已能创建平台侧应用草稿、发布到 AgentLens 工作区、运行 workflow/chatflow 并读取日志。",
            en: "The Dify workspace can create an AgentLens-side app draft, publish it to the workspace, run workflow/chatflow, and read logs."
          },
          caveats: [
            {
              zh: "这里的发布是 AgentLens 工作区发布；不是绕过 Dify 官方权限去改用户自己的 Studio。",
              en: "This publish action targets the AgentLens workspace; it does not bypass Dify permissions to modify a user's Studio."
            }
          ]
        },
        {
          id: "api_connector",
          status: "ready",
          label: { zh: "API 连接器", en: "API connector" },
          description: {
            zh: "Dify Service API 与 Knowledge API 已由平台服务端托管，前端不暴露密钥。",
            en: "Dify Service API and Knowledge API are hosted server-side by AgentLens; secrets are not exposed in the browser."
          },
          caveats: [
            {
              zh: "如果 Knowledge API 未配置，知识库按钮会显示服务端错误，而不是假装写入成功。",
              en: "If Knowledge API is not configured, knowledge buttons show server errors rather than pretending success."
            }
          ]
        }
      ]
    }
  },
  {
    id: "n8n-ai",
    source: "curated",
    name: "n8n AI",
    vendor: "n8n",
    intro: {
      zh: "把邮箱、表格、CRM、表单和大模型节点串成自动流程。适合把重复运营动作变成可回放、可审批的工作流。",
      en: "Connect email, sheets, CRM, forms, and model nodes into automated workflows with replayable logs and approval points."
    },
    tagline: {
      zh: "把重复运营动作变成自动流程，手机上直接触发",
      en: "Turn repetitive ops tasks into automated workflows you can trigger from your phone"
    },
    category: "Workflow automation",
    tags: ["workflow", "automation", "n8n", "ai", "self-host", "webhook", "operations"],
    scenarios: [
      scenario("workflow-automation"),
      scenario("knowledge-qa"),
      scenario("customer-support")
    ],
    unsuitableScenarios: [
      scenario("ide-coding"),
      scenario("defi-trading")
    ],
    recommendedFor: [
      { zh: "需要把表单、通知、审批和 CRM 串起来的运营团队", en: "Ops teams that need to connect forms, notifications, approvals, and CRM" },
      { zh: "希望自托管、可控凭证和流程日志的企业", en: "Companies that want self-hosting, controlled credentials, and workflow logs" },
      { zh: "想在手机工作区触发平台工作流的普通用户", en: "Users who want to trigger platform workflows from a mobile workspace" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "工作流一旦连接真实账号，错误动作可能会发送邮件、改 CRM 或触发通知。", en: "Once real accounts are connected, a bad workflow may send emails, mutate CRM, or trigger notifications." },
      { zh: "自托管需要维护数据库、凭证、备份和版本升级。", en: "Self-hosting requires database, credential, backup, and upgrade maintenance." }
    ],
    riskMitigation: [
      { zh: "先跑只读模板，再逐步开放写入动作。", en: "Start with read-only templates, then gradually allow write actions." },
      { zh: "所有外部写入动作前加人工确认和执行日志。", en: "Add human approval and execution logs before every external write." }
    ],
    accessTypes: ["local", "cloud", "api", "saas"],
    complexity: "medium",
    hasOnboardingGuide: true,
    officialUrl: "https://n8n.io",
    docsUrl: "https://docs.n8n.io/advanced-ai/",
    pricingHint: {
      zh: "云端版按套餐/执行量计费；自托管主要承担服务器和模型调用成本。",
      en: "Cloud is plan/execution based; self-hosting mainly pays for servers and model calls."
    },
    pricingUrl: "https://n8n.io/pricing",
    latestObservedAt: "2026-06-21",
    observationSummary: {
      zh: "已在平台能力层预留 n8n 工作区：workflow 草稿、模板、激活和日志读取可继续闭环。",
      en: "AgentLens already has an n8n workspace capability path for drafts, templates, activation, and execution logs."
    },
    capabilityContract: {
      mapFit: "workflow",
      inputTypes: ["text", "file", "url"],
      outputTypes: ["workflow", "report", "text"],
      requiredTools: ["model", "workflow-api"],
      runtimeMode: "external-adapter",
      mobileSupport: "partial",
      desktopSupport: "full",
      permissionNeeds: ["external-account"],
      pricingMode: "per-run",
      trustSignals: ["audit", "sample-output"],
      knownLimits: [
        { zh: "手机工作区可触发平台侧 n8n 适配器，但第三方账号 OAuth 和敏感写入仍要授权确认。", en: "The mobile workspace can trigger the AgentLens n8n adapter, but third-party OAuth and sensitive writes still need authorization." },
        { zh: "真实邮件、CRM、支付、审批等外部写入动作必须先进入人工确认。", en: "Real email, CRM, payment, approval, and other external writes must pass human confirmation first." }
      ],
      typicalTasks: [
        { zh: "创建自动审批工作流", en: "Create an automated approval workflow" },
        { zh: "把表单数据同步到 CRM", en: "Sync form data to a CRM" },
        { zh: "查看最近的执行记录", en: "View recent workflow execution logs" }
      ],
      moduleNarratives: [
        {
          id: "workflow_tools",
          status: "ready",
          label: { zh: "工作流 / 工具", en: "Workflow / tools" },
          description: {
            zh: "n8n 已接入 workflow 草稿、三类模板写入、workflow 更新、激活/发布和 execution 日志读取。",
            en: "n8n is connected for workflow drafts, three template writes, workflow updates, activation/publish, and execution logs."
          },
          caveats: [
            {
              zh: "凭证/OAuth 和敏感外部写入仍需要用户授权与二次确认。",
              en: "Credentials/OAuth and sensitive external writes still need user authorization and second confirmation."
            }
          ],
          testPrompt: {
            zh: "生成 AI Agent 审批草稿，写入 workflow，更新后激活并读取 execution。",
            en: "Draft an AI Agent approval flow, write the workflow, update it, activate it, and read execution evidence."
          }
        },
        {
          id: "api_connector",
          status: "ready",
          label: { zh: "API 连接器", en: "API connector" },
          description: {
            zh: "n8n REST API 已由平台服务端托管，可写入和激活 workflow。",
            en: "n8n REST API is hosted server-side and can write and activate workflows."
          },
          caveats: [
            {
              zh: "前端只触发平台 API；n8n API key 不下发到手机。",
              en: "The browser only calls AgentLens Platform API; the n8n API key is not sent to the phone."
            }
          ]
        },
        {
          id: "files_knowledge",
          status: "testable",
          label: { zh: "文件 / 知识库", en: "Files / knowledge" },
          description: {
            zh: "n8n 文件/表单类模板已能生成和写入 workflow；真实二进制文件通道还要继续扩展。",
            en: "n8n file/form templates can now be generated and written as workflows; real binary file channels still need expansion."
          },
          caveats: [
            {
              zh: "当前验证的是 workflow 结构和执行入口，不等同于所有第三方文件源已完成授权。",
              en: "This verifies workflow structure and execution entry, not every third-party file source authorization."
            }
          ]
        }
      ]
    }
  },
  {
    id: "zapier-agents",
    source: "curated",
    name: "Zapier Agents",
    vendor: "Zapier",
    intro: {
      zh: "面向普通业务用户的自动化 Agent，强项是连接大量 SaaS 应用，帮用户把线索、表单、邮件和任务流转起来。",
      en: "Business-friendly automation agents that connect many SaaS apps for leads, forms, emails, and task handoffs."
    },
    tagline: {
      zh: "不懂代码也能把多个软件串起来办事",
      en: "Connect apps and get work done without code"
    },
    category: "Workflow agent",
    tags: ["workflow", "automation", "zapier", "saas", "oauth", "crm", "forms"],
    scenarios: [
      scenario("workflow-automation"),
      scenario("customer-support"),
      scenario("content-generation")
    ],
    unsuitableScenarios: [
      scenario("ide-coding"),
      scenario("defi-trading")
    ],
    recommendedFor: [
      { zh: "希望少配置、快接入 SaaS 工具的中小团队", en: "Small teams that want quick SaaS automation with little setup" },
      { zh: "需要表单线索、邮件草稿、CRM 更新和通知流转的业务岗位", en: "Business roles handling leads, email drafts, CRM updates, and notifications" },
      { zh: "不想自托管工作流平台的普通用户", en: "Users who do not want to self-host a workflow platform" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "官方账号和第三方应用授权仍然在 Zapier 侧完成。", en: "Official account and third-party app authorization still happen on Zapier's side." },
      { zh: "生产账号写入、发送和删除动作需要二次确认。", en: "Production writes, sends, and deletes need second confirmation." }
    ],
    riskMitigation: [
      { zh: "首版只允许草稿、只读和测试空间动作。", en: "Start with drafts, read-only actions, and test workspaces." },
      { zh: "把平台积分、Zapier 用量和外部动作日志分开记录。", en: "Record platform credits, Zapier usage, and external action logs separately." }
    ],
    accessTypes: ["saas", "api", "cloud"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://zapier.com/agents",
    docsUrl: "https://help.zapier.com",
    pricingHint: {
      zh: "Zapier 账号按套餐/任务量计费；平台可在授权后按工作流执行折算积分。",
      en: "Zapier accounts are plan/task based; AgentLens can meter workflow runs after authorization."
    },
    pricingUrl: "https://zapier.com/pricing",
    latestObservedAt: "2026-06-21",
    observationSummary: {
      zh: "适合作为手机工作区的 SaaS 自动化入口，但真实连接需要用户授权。",
      en: "Good as a SaaS automation entry in the mobile workspace, but real connections require user authorization."
    }
  },
  {
    id: "coze",
    source: "curated",
    name: "Coze",
    vendor: "ByteDance / Coze",
    intro: {
      zh: "面向 Bot、工作流和知识库的 Agent 搭建平台，适合把一个业务问答、客服或运营助手快速发布到多端。",
      en: "An Agent-building platform for bots, workflows, and knowledge bases, useful for publishing support or operations assistants across channels."
    },
    tagline: {
      zh: "适合国内团队快速做 Bot、知识库和多渠道助手",
      en: "Fast bot, knowledge-base, and multi-channel assistant building"
    },
    category: "Agent platform",
    tags: ["agent-builder", "coze", "bot", "knowledge", "workflow", "low-code", "open-source"],
    scenarios: [
      scenario("workflow-automation"),
      scenario("knowledge-qa"),
      scenario("customer-support")
    ],
    unsuitableScenarios: [
      scenario("ide-coding"),
      scenario("defi-trading")
    ],
    recommendedFor: [
      { zh: "想快速发布客服 Bot 或运营助手的团队", en: "Teams that want to publish support bots or operations assistants quickly" },
      { zh: "需要 Bot、知识库、工作流和插件集中管理的产品团队", en: "Product teams that need bots, knowledge, workflows, and plugins managed together" },
      { zh: "偏国内使用场景、希望低代码搭建 Agent 的用户", en: "Users in China-oriented scenarios who want low-code Agent building" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "平台工作区接入前，用户自己的 Coze 项目和账号权限仍在官方侧。", en: "Before workspace integration, the user's Coze projects and account permissions remain official-side." },
      { zh: "多渠道发布会涉及用户数据、会话日志和第三方插件权限。", en: "Multi-channel publishing involves user data, chat logs, and third-party plugin permissions." }
    ],
    riskMitigation: [
      { zh: "先接只读问答和测试 Bot，再开放生产渠道。", en: "Connect read-only Q&A and test bots before production channels." },
      { zh: "插件调用、用户资料读取和外部写入都要做权限提示。", en: "Plugin calls, profile reads, and external writes require permission prompts." }
    ],
    accessTypes: ["saas", "api", "cloud", "local"],
    complexity: "medium",
    hasOnboardingGuide: true,
    officialUrl: "https://www.coze.com",
    docsUrl: "https://github.com/coze-dev/coze-studio",
    pricingHint: {
      zh: "官方 SaaS 与开源自托管路线并存；平台接入时按 Bot 调用、模型和工具动作折算积分。",
      en: "Official SaaS and open-source self-hosting both exist; AgentLens can meter bot calls, model use, and tool actions."
    },
    pricingUrl: "https://www.coze.com",
    latestObservedAt: "2026-06-21",
    observationSummary: {
      zh: "进入第一批热门平台卡：适合 Bot/知识库/工作流地图，不承诺绕过官方账号权限。",
      en: "First-batch popular platform card for bot, knowledge, and workflow maps; it does not bypass official account permissions."
    }
  },
  {
    id: "manus",
    source: "curated",
    name: "Manus",
    vendor: "Manus",
    intro: {
      zh: "面向复杂任务委托的通用 Agent，适合做研究、网页任务、资料整理和多步执行；平台内暂以官方入口和替代工作区为主。",
      en: "A general task-delegation agent for research, web tasks, information organization, and multi-step execution; AgentLens currently treats it as official-first with workspace substitutes."
    },
    tagline: {
      zh: "热度高，但当前以官方入口优先，平台只承接可替代能力",
      en: "High-demand, official-first, with platform substitutes for covered tasks"
    },
    category: "General task agent",
    tags: ["agent", "manus", "browser", "research", "task", "official-only"],
    scenarios: [
      scenario("market-research"),
      scenario("workflow-automation"),
      scenario("knowledge-qa")
    ],
    unsuitableScenarios: [
      scenario("ide-coding"),
      scenario("defi-trading")
    ],
    recommendedFor: [
      { zh: "想把多步骤调研或网页任务委托出去的用户", en: "Users who want to delegate multi-step research or web tasks" },
      { zh: "能接受官方账号跳转、平台做任务前置整理的用户", en: "Users who accept official account handoff while AgentLens prepares the task" },
      { zh: "需要清楚知道哪些能力平台暂时接不了的买家", en: "Buyers who need clear boundaries on what AgentLens cannot yet run" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "封闭式官方产品无法直接完整搬进手机工作区。", en: "A closed official product cannot be fully moved into the mobile workspace." },
      { zh: "涉及登录、付款、发消息和提交表单时必须明确授权。", en: "Login, payment, messaging, and form submission require explicit permission." }
    ],
    riskMitigation: [
      { zh: "卡片明确标注官方优先，不把平台替代能力说成官方 Manus。", en: "Mark it official-first and never describe substitutes as the official Manus runtime." },
      { zh: "平台先覆盖研究、整理和任务规划，真实账号动作走官方或授权沙箱。", en: "AgentLens first covers research, organization, and planning; real-account actions go through official or authorized sandboxes." }
    ],
    accessTypes: ["saas", "cloud"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://manus.im",
    docsUrl: "https://manus.im",
    pricingHint: {
      zh: "以官方账号和套餐为准；平台暂不承诺代付官方额度。",
      en: "Depends on official account plans; AgentLens does not yet promise official quota settlement."
    },
    pricingUrl: "https://manus.im",
    latestObservedAt: "2026-06-21",
    observationSummary: {
      zh: "作为热门官方 Agent 重新上架，但运行边界要比开源/可 API 接入 Agent 更保守。",
      en: "Restored as a popular official Agent, with stricter runtime boundaries than open-source or API-ready Agents."
    }
  },
  {
    id: "openclaw",
    source: "curated",
    name: "OpenClaw",
    vendor: "OpenClaw",
    intro: {
      zh: "面向多渠道消息和工具调用的开源 Agent 候选，适合把 Telegram、WhatsApp、Slack 等入口和平台工作区串起来。",
      en: "An open-source candidate for multi-channel messaging and tool use, useful for connecting Telegram, WhatsApp, Slack, and the AgentLens workspace."
    },
    tagline: {
      zh: "把多端聊天入口接成一个可控 Agent 工作流",
      en: "Connect chat channels into one controlled Agent workflow"
    },
    category: "Messaging workflow agent",
    tags: ["openclaw", "openclow", "messaging", "telegram", "whatsapp", "slack", "workflow", "self-host"],
    scenarios: [
      scenario("workflow-automation"),
      scenario("customer-support"),
      scenario("browser-automation")
    ],
    unsuitableScenarios: [
      scenario("ide-coding"),
      scenario("defi-trading")
    ],
    recommendedFor: [
      { zh: "希望把聊天入口、机器人和工具调用统一管理的团队", en: "Teams that want to manage chat entries, bots, and tool calls together" },
      { zh: "需要手机端能发起消息工作流的运营或客服场景", en: "Operations or support teams that need mobile-triggered messaging workflows" },
      { zh: "愿意自托管并保留会话与工具日志的技术团队", en: "Technical teams willing to self-host and keep chat/tool logs" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "消息类 Agent 涉及联系人、群聊、私聊和外部发送权限。", en: "Messaging agents touch contacts, groups, private chats, and external send permissions." },
      { zh: "不同渠道的 API 和合规边界差异很大。", en: "Channel APIs and compliance boundaries differ greatly." }
    ],
    riskMitigation: [
      { zh: "先只接测试频道，发送动作必须人工确认。", en: "Start with test channels and require approval before sending." },
      { zh: "把渠道凭证、消息日志和用户授权放在服务端托管。", en: "Keep channel credentials, message logs, and user authorization server-side." }
    ],
    accessTypes: ["local", "cloud", "api"],
    complexity: "medium",
    hasOnboardingGuide: true,
    officialUrl: "https://openclaw.ai/",
    docsUrl: "https://docs.openclaw.ai/",
    pricingHint: {
      zh: "开源/自托管优先；平台按消息任务、模型调用和渠道动作折算积分。",
      en: "Open-source/self-host first; AgentLens can meter messaging tasks, model calls, and channel actions."
    },
    pricingUrl: "https://openclaw.ai/",
    latestObservedAt: "2026-06-21",
    observationSummary: {
      zh: "按正式热门 Agent 重新建卡，不恢复旧空壳；后续进入消息/工作流地图。",
      en: "Rebuilt as a formal popular Agent card, not a legacy placeholder; later fits the messaging/workflow map."
    }
  },
  {
    id: "crewai-platform",
    source: "curated",
    name: "CrewAI",
    vendor: "CrewAI",
    intro: {
      zh: "多 Agent 协作框架，用角色、任务和工具把复杂工作拆给一组 Agent 执行，适合做平台工作区里的 Agent 编排底座。",
      en: "A multi-agent collaboration framework that splits work across roles, tasks, and tools, useful as an orchestration base inside the AgentLens workspace."
    },
    tagline: {
      zh: "适合把一个复杂任务拆成多个 Agent 分工完成",
      en: "Split complex work across cooperating Agents"
    },
    category: "Multi-agent framework",
    tags: ["agent-platform", "multi-agent", "crewai", "orchestration", "python", "open-source"],
    scenarios: [
      scenario("workflow-automation"),
      scenario("developer-assistant"),
      scenario("market-research")
    ],
    unsuitableScenarios: [
      scenario("customer-support"),
      scenario("defi-trading")
    ],
    recommendedFor: [
      { zh: "想把调研、写作、审查、执行拆成多角色流程的团队", en: "Teams splitting research, writing, review, and execution into multi-role flows" },
      { zh: "需要快速搭平台工作区 Agent 原型的开发者", en: "Developers prototyping workspace Agents quickly" },
      { zh: "愿意维护 Python 服务和工具权限的技术团队", en: "Technical teams willing to maintain Python services and tool permissions" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "多 Agent 流程容易放大错误，需要任务边界和停止条件。", en: "Multi-agent flows can amplify mistakes and need task boundaries plus stop conditions." },
      { zh: "框架不是成品 SaaS，仍需平台自己做 UI、权限和计费。", en: "The framework is not a finished SaaS product; AgentLens still needs UI, permissions, and metering." }
    ],
    riskMitigation: [
      { zh: "每个角色只开放必要工具，并保存中间结论。", en: "Give each role only necessary tools and persist intermediate conclusions." },
      { zh: "把它作为平台工作区 Agent 底座，而不是直接卖给普通用户配置。", en: "Use it as an AgentLens workspace Agent base rather than exposing raw configuration to consumers." }
    ],
    accessTypes: ["local", "cloud", "api"],
    complexity: "high",
    hasOnboardingGuide: true,
    officialUrl: "https://www.crewai.com",
    docsUrl: "https://docs.crewai.com",
    pricingHint: {
      zh: "框架可自托管；真实成本来自模型、工具调用和云端运行时。",
      en: "The framework can be self-hosted; real cost comes from models, tool calls, and cloud runtime."
    },
    pricingUrl: "https://www.crewai.com",
    latestObservedAt: "2026-06-21",
    observationSummary: {
      zh: "适合作为平台工作区 Agent 编排底座，卡片面向买家解释为“多角色协作执行”。",
      en: "Suitable as an AgentLens workspace orchestration base, explained to buyers as multi-role execution."
    }
  },
  {
    id: "autogen-studio",
    source: "curated",
    name: "AutoGen",
    vendor: "Microsoft",
    intro: {
      zh: "微软开源的 Agent 框架，适合搭多 Agent 对话、工具调用和实验型工作流；更偏技术团队和研究验证。",
      en: "Microsoft's open-source Agent framework for multi-agent conversations, tool use, and experimental workflows, mainly for technical teams and research validation."
    },
    tagline: {
      zh: "适合研究和技术团队做多 Agent 实验",
      en: "For technical teams experimenting with multi-agent systems"
    },
    category: "Agent framework",
    tags: ["agent-platform", "autogen", "microsoft", "multi-agent", "framework", "open-source"],
    scenarios: [
      scenario("developer-assistant"),
      scenario("workflow-automation"),
      scenario("data-analysis")
    ],
    unsuitableScenarios: [
      scenario("customer-support"),
      scenario("content-generation")
    ],
    recommendedFor: [
      { zh: "需要验证多 Agent 架构、工具协议和任务分配的技术团队", en: "Technical teams validating multi-agent architecture, tool protocols, and task assignment" },
      { zh: "希望把研究原型逐步迁移到平台工作区的开发者", en: "Developers moving research prototypes into the AgentLens workspace" },
      { zh: "已有模型和工具运行环境的企业实验组", en: "Enterprise labs that already have model and tool runtimes" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "更像开发框架，不是普通用户开箱即用的成品 Agent。", en: "It is a developer framework rather than a consumer-ready Agent product." },
      { zh: "多 Agent 对话需要控制成本、循环和工具权限。", en: "Multi-agent conversations require cost, loop, and tool-permission controls." }
    ],
    riskMitigation: [
      { zh: "先把它用于平台工作区 Agent 原型，不直接暴露复杂配置。", en: "Use it first for workspace Agent prototypes, not raw consumer-facing configuration." },
      { zh: "给每轮对话、工具调用和失败状态做日志。", en: "Log every conversation round, tool call, and failure state." }
    ],
    accessTypes: ["local", "cloud", "api"],
    complexity: "high",
    hasOnboardingGuide: true,
    officialUrl: "https://github.com/microsoft/autogen",
    docsUrl: "https://microsoft.github.io/autogen/",
    pricingHint: {
      zh: "框架开源；成本来自模型调用、工具执行和部署资源。",
      en: "The framework is open-source; costs come from model calls, tool execution, and deployment resources."
    },
    pricingUrl: "https://github.com/microsoft/autogen",
    latestObservedAt: "2026-06-21",
    observationSummary: {
      zh: "作为技术型热门框架卡保留，后续更适合承接平台工作区 Agent，而不是普通用户直接配置。",
      en: "Kept as a popular technical framework card, best suited for workspace Agents rather than direct consumer setup."
    }
  },
  {
    id: "langgraph-platform",
    source: "curated",
    name: "LangGraph",
    vendor: "LangChain",
    intro: {
      zh: "面向长流程 Agent 的状态图框架，适合把记忆、工具、审批、分支和重试做成稳定的工作区底座。",
      en: "A state-graph framework for long-running Agents, useful for stable workspace flows with memory, tools, approval, branching, and retries."
    },
    tagline: {
      zh: "适合做平台工作区“主地图”的长流程底座",
      en: "A strong base for the workspace's main long-running map"
    },
    category: "Agent orchestration",
    tags: ["agent-platform", "langgraph", "langchain", "state-machine", "workflow", "memory", "open-source"],
    scenarios: [
      scenario("workflow-automation"),
      scenario("developer-assistant"),
      scenario("knowledge-qa")
    ],
    unsuitableScenarios: [
      scenario("customer-support"),
      scenario("defi-trading")
    ],
    recommendedFor: [
      { zh: "要把 Agent 做成可恢复、可中断、可审批长流程的平台团队", en: "Platform teams that need resumable, interruptible, approvable long-running Agents" },
      { zh: "希望把多工具调用和记忆纳入统一状态图的开发者", en: "Developers unifying tool calls and memory in a state graph" },
      { zh: "准备扩展平台工作区主地图的技术团队", en: "Technical teams expanding the AgentLens workspace main map" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "它是底层编排框架，不是面向买家的现成应用。", en: "It is an orchestration framework, not a buyer-facing finished app." },
      { zh: "状态、持久化、权限和回放如果没设计好，长流程会难以排查。", en: "Without good state, persistence, permission, and replay design, long flows are hard to debug." }
    ],
    riskMitigation: [
      { zh: "把 LangGraph 用作平台内部底座，外层包装成普通用户能懂的工作区体验。", en: "Use LangGraph internally while wrapping it in a consumer-friendly workspace experience." },
      { zh: "每个节点记录输入、输出、工具调用和人工确认状态。", en: "Record inputs, outputs, tool calls, and approval state for every node." }
    ],
    accessTypes: ["local", "cloud", "api"],
    complexity: "high",
    hasOnboardingGuide: true,
    officialUrl: "https://github.com/langchain-ai/langgraph",
    docsUrl: "https://langchain-ai.github.io/langgraph/",
    pricingHint: {
      zh: "框架开源；平台成本来自模型、存储、队列和运行时。",
      en: "The framework is open-source; platform cost comes from models, storage, queues, and runtime."
    },
    pricingUrl: "https://github.com/langchain-ai/langgraph",
    latestObservedAt: "2026-06-21",
    observationSummary: {
      zh: "作为工作区主地图底座候选加入，不把它包装成普通用户直接配置的成品 Agent。",
      en: "Added as a workspace main-map base candidate, not positioned as a consumer-configured finished Agent."
    }
  },
  {
    id: "perplexity",
    source: "curated",
    name: "Perplexity",
    vendor: "Perplexity AI",
    intro: {
      zh: "对话式搜索与研究助手，实时联网检索并附带可点击的引用来源，是调研工作流的快速入口。",
      en: "Conversational search and research assistant with live web retrieval and inline source citations — a fast entry point for any research workflow."
    },
    tagline: {
      zh: "问一个问题，拿到带来源的完整答案，不是广告",
      en: "Ask a question, get a sourced answer — not an ad"
    },
    category: "Research assistant",
    tags: ["search", "research", "rag", "citations"],
    scenarios: [
      scenario("market-research"),
      scenario("knowledge-qa"),
      scenario("content-generation")
    ],
    unsuitableScenarios: [scenario("ide-coding"), scenario("defi-trading")],
    recommendedFor: [
      { zh: "需要快速带引用做市场或竞品调研的团队", en: "Teams that need fast, citation-backed market or competitive research" },
      { zh: "内容团队用于找数据和佐证观点", en: "Content teams looking for data points and supporting evidence" },
      { zh: "需要给非技术同事提供实时信息的运营岗位", en: "Operations roles that need to surface live information for non-technical colleagues" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "答案是二次综合，重要决策的核心数据仍需核查一手来源。", en: "Answers are synthesised summaries — verify primary sources for critical decisions." },
      { zh: "部分检索结果是旧版本页面，注意发布日期。", en: "Some results index older page versions — check publication dates." }
    ],
    riskMitigation: [
      { zh: "把 Perplexity 答案里的引用链接单独存档，后续做一手来源核验。", en: "Archive the source URLs from answers separately for later primary-source verification." },
      { zh: "用 Academic 模式时选择高引用率来源，过滤低质量内容。", en: "In Academic mode, filter for high-citation sources to reduce low-quality content." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://www.perplexity.ai",
    docsUrl: "https://docs.perplexity.ai",
    pricingHint: {
      zh: "免费层每日有限次，Pro 计划约 $20/月，API 按 token 计费。",
      en: "Free tier with daily limits; Pro plan ~$20/month; API priced per token."
    },
    pricingUrl: "https://www.perplexity.ai/pro"
  },
  {
    id: "midjourney",
    source: "curated",
    name: "Midjourney",
    vendor: "Midjourney",
    intro: {
      zh: "高质量图像生成模型，通过 Discord Bot 和 midjourney.com Web 入口使用，风格可控性强，适合营销素材和 UI 概念图生成。",
      en: "High-quality image generation model via Discord and web. Strong style control makes it a go-to for marketing assets and UI concept generation."
    },
    tagline: {
      zh: "最成熟的风格化图像生成工具，适合快速出视觉素材",
      en: "The most mature stylised image generator for fast visual asset creation"
    },
    category: "Image generation",
    tags: ["image", "design", "creative", "marketing"],
    scenarios: [
      scenario("content-generation"),
      scenario("ui-prototyping")
    ],
    unsuitableScenarios: [scenario("ide-coding"), scenario("data-analysis")],
    recommendedFor: [
      { zh: "需要快速出风格化营销素材的创意团队", en: "Creative teams that need stylised marketing assets fast" },
      { zh: "做 UI 概念图和品牌视觉方向验证的设计师", en: "Designers exploring UI concepts and brand visual directions" },
      { zh: "内容团队需要批量生成社媒配图", en: "Content teams generating social media images at scale" }
    ],
    riskLevel: "low",
    riskNotes: [
      { zh: "商用前需确认订阅计划的授权条款。", en: "Confirm the licence terms of your subscription plan before commercial use." },
      { zh: "含名人、品牌 logo 等元素的生成图存在 IP 风险。", en: "Outputs referencing celebrities or brand logos carry IP risk." }
    ],
    riskMitigation: [
      { zh: "Pro 计划以上可开启隐私模式，避免生成内容公开显示在社区画廊。", en: "Pro plan and above can enable Stealth mode to stop generated images appearing in the community gallery." },
      { zh: "建立团队提示词库沉淀品牌风格词和禁用词。", en: "Maintain a shared prompt library with brand style keywords and blocked terms." }
    ],
    accessTypes: ["saas", "browser_ext"],
    complexity: "low",
    hasOnboardingGuide: true,
    officialUrl: "https://www.midjourney.com",
    docsUrl: "https://docs.midjourney.com",
    pricingHint: {
      zh: "Basic 约 $10/月，Pro $60/月（含隐私模式）。按 GPU 时长计费，高频用户建议 Standard 或 Pro。",
      en: "Basic ~$10/month, Pro $60/month (includes Stealth mode). Billed by GPU hours — high-volume users should consider Standard or Pro."
    },
    pricingUrl: "https://www.midjourney.com/account"
  },
  {
    id: "intercom-fin",
    source: "curated",
    name: "Intercom Fin",
    vendor: "Intercom",
    intro: {
      zh: "基于 Intercom 平台的 AI 客服 Agent，可接入帮助中心数据自动解答客户问题，支持多渠道对话和人工升级。",
      en: "AI support agent built on the Intercom platform that ingests help-centre content to auto-resolve customer questions across channels with human escalation."
    },
    tagline: {
      zh: "适合客服量大、希望把常见问题自动化的团队",
      en: "For high-volume support teams automating common questions without losing brand voice"
    },
    category: "Support agent",
    tags: ["support", "customer-service", "intercom", "knowledge"],
    scenarios: [
      scenario("customer-support"),
      scenario("knowledge-qa")
    ],
    unsuitableScenarios: [scenario("ide-coding"), scenario("defi-trading")],
    recommendedFor: [
      { zh: "客服量大但希望保持品牌口吻的成长期团队", en: "Growing support teams with high volume that want to keep brand voice consistent" },
      { zh: "帮助中心文档质量高、希望把自动解答率提升到 60%+ 的团队", en: "Teams with high-quality help centres aiming to push auto-resolution above 60%" },
      { zh: "已经在用 Intercom 做客服的团队（接入成本最低）", en: "Teams already using Intercom for support — lowest integration cost" }
    ],
    riskLevel: "medium",
    riskNotes: [
      { zh: "回答质量与帮助中心文章一致性强相关，需要先做内容治理。", en: "Answer quality tracks help-centre article quality — invest in content governance first." },
      { zh: "未设置人工升级路径会导致复杂问题陷入僵局。", en: "Without an escalation path, complex issues get stuck in the bot loop." }
    ],
    riskMitigation: [
      { zh: "上线前用 100 条真实对话在测试环境跑一遍，补齐知识空白。", en: "Run 100 real conversations through Fin in test mode before launch to surface knowledge gaps." },
      { zh: "设置明确的人工转接触发词和路由规则。", en: "Configure explicit trigger phrases and routing rules for human handoff." }
    ],
    accessTypes: ["saas", "api"],
    complexity: "medium",
    hasOnboardingGuide: true,
    officialUrl: "https://www.intercom.com/fin",
    docsUrl: "https://www.intercom.com/help/en/articles/8205718",
    pricingHint: {
      zh: "按 Fin 解决的对话数收费（Resolution-based pricing），未解决的对话不计费。",
      en: "Priced per resolved conversation (resolution-based) — unresolved conversations are not charged."
    },
    pricingUrl: "https://www.intercom.com/pricing"
  }
];
