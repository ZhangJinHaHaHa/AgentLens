import type { AgentCatalogEntry } from "@/domain/catalog";

import { scenario } from "./scenarios";

/**
 * Editorial set — 10 agents we actively maintain.
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
    }
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
  }
];
