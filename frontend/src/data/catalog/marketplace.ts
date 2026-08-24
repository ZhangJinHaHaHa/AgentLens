import type { AgentCatalogEntry } from "@/domain/catalog";

import { scenario } from "./scenarios";

/**
 * Marketplace tier — seller-listed expert agents.
 *
 * Unlike curated/listed (big-tech tools we link out to), these are agents an
 * individual expert lists ON the platform. Their edge is the seller's private
 * accumulated context (years of real case files, deal records, playbooks) — the
 * raw corpus is never handed over; only the judgment is served as inference.
 * The platform's job is matchmaking + trust (access grant, settlement,
 * reputation, future TEE attestation).
 *
 * MVP modelling notes:
 *   - `source: "marketplace"`, NO `tokenId` → detail page renders the editorial
 *     `CuratedBlock`, not the on-chain `NativeChainPanel` (nothing on-chain yet).
 *   - NO `officialUrl` — these live on-platform, not on a vendor site.
 *   - Trust tier is earned, not claimed: a few carry `latestObservedAt` +
 *     `observationSummary` (→ Tier 1); the rest sit at Tier 0 until they accrue
 *     attestation/reputation. `trustTierHint` can only downgrade, so we do NOT
 *     use it to fake higher tiers.
 *   - Regulated domains (legal/tax/insurance) state "assist, not replace a
 *     licensed professional" in intro + riskNotes.
 */
/*
 * 当前三项是“平台准备托管的开源能力候选”，不是已经可购买执行的卖家运行实例；资料来源是对应
 * 开源仓库与平台接入规划，输出供货架、买家卡、工作区地图和运行边界说明使用。
 * platform- 前缀是有意保留的稳定命名空间，用来与 curated 中同名的官方 OpenHands/browser-use 卡并存；
 * 改成产品短名会让合并索引和详情链接发生碰撞。数组顺序同时是 marketplace 首屏的编辑优先级，
 * 且整个分桶会先于 curated 展示，因此不能把排序职责下沉到卡片组件。
 * 这里的 managed-runtime-candidate、运行安全文案和能力合同均不得被解释为已部署、已审计或已授权，
 * 更不能承担沙箱、许可、付款确认或人工复核逻辑。运行器未接通、仓库授权不足或网页动作越权时，
 * 正确边界是保持候选/拒绝执行；若文案与真实接入状态漂移，应更新事实而不是在 UI 中猜测可用性。
 */
export const marketplaceAgents: AgentCatalogEntry[] = [
  {
    id: "platform-deepaudit",
    source: "marketplace",
    name: "DeepAudit",
    vendor: "lintsinghua/DeepAudit",
    seller: {
      kind: "platform",
      label: { zh: "DeepAudit 开源仓库", en: "DeepAudit open-source repo" },
      contextScale: {
        zh: "多 Agent 漏洞审计流程、PoC 验证、报告生成与沙箱运行计划",
        en: "Multi-agent vulnerability audit flow, PoC validation, report generation, and sandbox-runtime plan"
      }
    },
    intro: {
      zh: "DeepAudit 是面向代码漏洞审计的多 Agent 安全工具。平台第一阶段把它作为安全审计 Agent 托管候选：用户提交仓库或代码包后，目标是输出风险清单、漏洞证据、PoC 验证记录和修复建议。",
      en: "DeepAudit is a multi-agent security tool for code vulnerability auditing. AgentLens treats it as a first-batch hosted security-audit Agent candidate: after a repo or code package is submitted, the target deliverable is a risk list, vulnerability evidence, PoC validation notes, and fix guidance."
    },
    tagline: {
      zh: "把代码包变成一份可复核的漏洞审计报告",
      en: "Turn a code package into a reviewable vulnerability audit report"
    },
    category: "Security audit agent",
    tags: ["managed-runtime-candidate", "github", "security", "audit", "multi-agent", "code", "open-source", "agpl"],
    scenarios: [scenario("security-audit"), scenario("developer-assistant")],
    unsuitableScenarios: [scenario("content-generation"), scenario("customer-support")],
    recommendedFor: [
      { zh: "需要上线前做代码安全初筛的小团队", en: "Small teams that need a pre-launch security triage pass" },
      { zh: "想把审计过程、证据和修复建议一起留档的开发者", en: "Developers who want audit process, evidence, and remediation notes in one record" }
    ],
    riskLevel: "high",
    riskNotes: [
      { zh: "安全审计会处理高敏感代码，正式运行前必须接平台沙箱、权限隔离和日志脱敏。", en: "Security audits process sensitive code; platform sandboxing, permission isolation, and log redaction must be connected before production use." },
      { zh: "漏洞结论可能有误报或漏报，不能替代人工安全评审。", en: "Findings can contain false positives or false negatives and must not replace human security review." },
      { zh: "开源协议为强约束类型，上线商业托管前需要保留授权记录和合规说明。", en: "The repository uses a strong open-source license family; commercial hosting needs authorization records and compliance notes." }
    ],
    riskMitigation: [
      { zh: "第一阶段只接测试仓库和授权代码包，禁止上传第三方未授权源码。", en: "Phase one should accept only test repos and authorized code packages; never upload third-party code without permission." },
      { zh: "所有漏洞报告默认进入人工复核队列，再进入信誉与审计记录。", en: "All vulnerability reports should enter human review before reputation and audit records are updated." }
    ],
    accessTypes: ["local", "cloud", "api"],
    complexity: "high",
    hasOnboardingGuide: false,
    docsUrl: "https://github.com/lintsinghua/DeepAudit",
    pricingHint: {
      zh: "待接平台运行器后按代码规模、模型消耗和 PoC 验证次数折算积分。",
      en: "After platform runtime integration, credits should be estimated by code size, model usage, and PoC validation count."
    },
    latestObservedAt: "2026-06-21",
    observationSummary: {
      zh: "第一批托管候选：适合进入代码地图，当前先补货架资料和能力边界，运行器待接。",
      en: "First-batch hosted candidate: fits the code map; card metadata and boundaries are ready first, runtime integration pending."
    },
    buyerCard: {
      tasks: [
        { zh: "上传代码包做漏洞初筛", en: "Upload a code package for vulnerability triage" },
        { zh: "生成漏洞证据和 PoC 记录", en: "Generate vulnerability evidence and PoC notes" },
        { zh: "输出修复建议和风险等级", en: "Output remediation guidance and risk levels" }
      ],
      deliverable: {
        zh: "漏洞清单、证据摘要、PoC 验证记录、修复建议和可进入平台审计的报告草案。",
        en: "A vulnerability list, evidence summary, PoC validation notes, remediation guidance, and an audit-ready report draft."
      },
      notFor: {
        zh: "不适合未授权代码、生产密钥仓库或需要 100% 漏洞保证的场景。",
        en: "Not for unauthorized code, repositories containing production secrets, or scenarios that require a 100% vulnerability guarantee."
      },
      runMode: {
        zh: "平台代码地图候选；下一步接平台沙箱和自托管运行器后再标可用。",
        en: "Code-map candidate; mark it ready only after AgentLens connects sandboxing and a self-hosted runtime."
      },
      dataBoundary: {
        zh: "接通前只作为货架候选；接通后代码进入平台沙箱，日志和报告进入审计/信誉链路。",
        en: "Before integration it is a shelf candidate only; after integration code enters the platform sandbox and logs/reports feed audit and reputation."
      },
      differentiation: {
        zh: "它的价值是安全审计流程、漏洞证据和 PoC 验证，不是普通模型解释代码。",
        en: "Its value is the security-audit workflow, vulnerability evidence, and PoC validation, not generic code explanation."
      }
    },
    runtimeSecurity: {
      kind: "external_tool",
      label: { zh: "开源仓库待托管", en: "Open-source repo pending hosting" },
      description: {
        zh: "已选入托管候选，但生产运行器、沙箱和镜像审计尚未接通。",
        en: "Selected as a hosted candidate, but production runtime, sandboxing, and image audit are not connected yet."
      },
      evidenceLabel: { zh: "待托管", en: "Pending hosting" }
    },
    capabilityContract: {
      mapFit: "code",
      inputTypes: ["text", "file", "repo"],
      outputTypes: ["report", "table", "patch", "file"],
      requiredTools: ["model", "file-parser", "code-runner", "remote-runtime", "audit-log"],
      runtimeMode: "managed-runtime",
      mobileSupport: "partial",
      desktopSupport: "partial",
      permissionNeeds: ["file-access", "repo-access"],
      pricingMode: "per-run",
      trustSignals: ["audit", "reputation", "chain-proof", "sample-output"],
      knownLimits: [
        { zh: "接入平台沙箱前不能处理真实生产仓库。", en: "It must not process real production repos before the platform sandbox is connected." },
        { zh: "输出只能作为安全初筛，不能替代人工漏洞复核。", en: "The output is security triage only and cannot replace human vulnerability review." }
      ],
      typicalTasks: [
        { zh: "扫描代码包并生成漏洞清单", en: "Scan a code package and produce a vulnerability list" },
        { zh: "输出带证据的安全审计报告", en: "Output a security audit report with evidence" },
        { zh: "生成修复建议和 PoC 验证记录", en: "Generate remediation guidance and PoC notes" }
      ]
    },
    demoVideos: [
      {
        title: {
          zh: "3 分钟：从代码包到漏洞审计报告",
          en: "3 min: from code package to vulnerability report"
        },
        summary: {
          zh: "演示用户上传测试仓库，DeepAudit 在平台代码地图里完成漏洞初筛、证据整理、PoC 记录和修复建议。",
          en: "Shows a user uploading a test repo while DeepAudit runs triage, evidence collection, PoC notes, and remediation guidance in the code map."
        },
        status: "planned",
        durationLabel: { zh: "约 3 分钟", en: "About 3 minutes" },
        transcript: [
          { zh: "上传授权测试仓库或代码包，并选择安全审计任务。", en: "Upload an authorized test repo or code package and choose the security-audit task." },
          { zh: "平台沙箱运行 DeepAudit，生成漏洞清单、证据片段和 PoC 验证记录。", en: "The platform sandbox runs DeepAudit and produces findings, evidence snippets, and PoC notes." },
          { zh: "用户查看风险等级、修复建议和可进入审计链路的报告草案。", en: "The user reviews risk levels, fixes, and an audit-ready report draft." }
        ]
      }
    ]
  },
  {
    id: "platform-openhands",
    source: "marketplace",
    name: "OpenHands",
    vendor: "OpenHands",
    seller: {
      kind: "platform",
      label: { zh: "OpenHands 开源仓库", en: "OpenHands open-source repo" },
      contextScale: {
        zh: "开源自主工程 Agent、仓库任务、代码补丁、测试执行和人工复核流程",
        en: "Open-source autonomous engineering Agent, repo tasks, code patches, test execution, and human-review workflow"
      }
    },
    intro: {
      zh: "OpenHands 是开源自主软件工程 Agent。平台第一阶段把它作为代码地图候选：用户提交仓库任务后，目标是在平台沙箱中生成计划、补丁、测试结果和可复核的变更说明。",
      en: "OpenHands is an open-source autonomous software-engineering Agent. AgentLens treats it as a code-map candidate: after a repo task is submitted, the target is to produce a plan, patch, test result, and reviewable change notes inside the platform sandbox."
    },
    tagline: {
      zh: "把开源工程 Agent 放进平台代码地图",
      en: "Bring an open-source engineering Agent into the platform code map"
    },
    category: "Coding agent",
    tags: ["managed-runtime-candidate", "github", "coding", "openhands", "self-host", "repo", "open-source", "mit"],
    scenarios: [scenario("agentic-coding"), scenario("developer-assistant"), scenario("security-audit")],
    unsuitableScenarios: [scenario("customer-support"), scenario("content-generation")],
    recommendedFor: [
      { zh: "想在平台里提交代码任务、看补丁和测试结果的开发团队", en: "Dev teams that want to submit code tasks and review patches/tests inside AgentLens" },
      { zh: "需要可审计代码工作流，而不是只要聊天写代码的用户", en: "Users who need an auditable coding workflow, not just chat-based code snippets" }
    ],
    riskLevel: "high",
    riskNotes: [
      { zh: "自主工程 Agent 会读写仓库，必须限制分支、文件范围、网络和命令权限。", en: "Autonomous coding Agents read and write repos; branch, file, network, and command permissions must be restricted." },
      { zh: "复杂任务可能失败或生成错误补丁，必须保留人工 review。", en: "Complex tasks can fail or create faulty patches, so human review is required." }
    ],
    riskMitigation: [
      { zh: "只在临时分支和沙箱仓库运行，默认不直接合并到主分支。", en: "Run only on temporary branches and sandbox repos; never merge to main by default." },
      { zh: "每次执行必须保存计划、diff、测试输出和失败原因。", en: "Every run must save the plan, diff, test output, and failure reason." }
    ],
    accessTypes: ["local", "cloud", "api"],
    complexity: "high",
    hasOnboardingGuide: false,
    docsUrl: "https://github.com/OpenHands/openhands",
    pricingHint: {
      zh: "待接代码地图后按仓库规模、执行时长、模型消耗和测试次数折算积分。",
      en: "After code-map integration, credits should be estimated by repo size, runtime duration, model usage, and test count."
    },
    latestObservedAt: "2026-06-21",
    observationSummary: {
      zh: "第一批托管候选：适合代码地图，当前先补平台版商品卡，不替代外部 OpenHands 官方条目。",
      en: "First-batch hosted candidate: fits the code map; this adds the AgentLens hosted-candidate shelf card, not a replacement for the external OpenHands listing."
    },
    buyerCard: {
      tasks: [
        { zh: "连接仓库生成修改计划", en: "Connect a repo and generate an implementation plan" },
        { zh: "产出代码补丁和测试结果", en: "Produce code patches and test results" },
        { zh: "把执行过程留成审计记录", en: "Keep the execution record as audit evidence" }
      ],
      deliverable: {
        zh: "任务计划、代码 diff、测试输出、失败原因、复核清单和可提交的变更说明。",
        en: "An implementation plan, code diff, test output, failure reasons, review checklist, and submit-ready change notes."
      },
      notFor: {
        zh: "不适合不给仓库权限、不能跑测试或要求自动直接合并的任务。",
        en: "Not for tasks without repo access, without testability, or requiring automatic direct merges."
      },
      runMode: {
        zh: "平台代码地图候选；下一步接仓库沙箱、命令白名单、diff 预览和测试运行。",
        en: "Code-map candidate; next step is repo sandboxing, command allowlists, diff preview, and test execution."
      },
      dataBoundary: {
        zh: "接通后仓库进入平台隔离运行区；diff、测试日志和命令记录进入任务审计。",
        en: "After integration repos enter the isolated platform runtime; diffs, test logs, and commands feed task audit."
      },
      differentiation: {
        zh: "它的价值是自主执行代码任务和保留 diff/测试证据，不是普通代码问答。",
        en: "Its value is autonomous code-task execution with diff/test evidence, not generic coding Q&A."
      }
    },
    runtimeSecurity: {
      kind: "external_tool",
      label: { zh: "开源仓库待托管", en: "Open-source repo pending hosting" },
      description: {
        zh: "已选入托管候选，但代码地图运行器和仓库沙箱尚未接通。",
        en: "Selected as a hosted candidate, but the code-map runtime and repo sandbox are not connected yet."
      },
      evidenceLabel: { zh: "待托管", en: "Pending hosting" }
    },
    capabilityContract: {
      mapFit: "code",
      inputTypes: ["text", "repo", "file", "url"],
      outputTypes: ["patch", "report", "file", "text"],
      requiredTools: ["model", "file-parser", "code-runner", "remote-runtime", "audit-log"],
      runtimeMode: "managed-runtime",
      mobileSupport: "partial",
      desktopSupport: "partial",
      permissionNeeds: ["repo-access", "file-access", "external-account"],
      pricingMode: "per-tool",
      trustSignals: ["audit", "reputation", "sample-output"],
      knownLimits: [
        { zh: "不能默认直接合并代码；所有 diff 必须人工确认。", en: "It must not merge code by default; every diff requires human review." },
        { zh: "接入前只能作为平台代码地图候选，不能承诺真实仓库执行。", en: "Before integration it is only a code-map candidate and cannot promise real repo execution." }
      ],
      typicalTasks: [
        { zh: "提交一个功能目标，生成修改计划和代码补丁", en: "Submit a feature goal and get an implementation plan plus code patch" },
        { zh: "运行测试并查看失败原因和审计记录", en: "Run tests and view failure reasons with an audit record" },
        { zh: "查看 diff 并决定是否采纳变更", en: "Review the diff and decide whether to accept the change" }
      ]
    },
    demoVideos: [
      {
        title: {
          zh: "4 分钟：从仓库任务到 diff 和测试结果",
          en: "4 min: from repo task to diff and tests"
        },
        summary: {
          zh: "演示用户提交一个代码任务，OpenHands 在平台代码地图中生成计划、修改 diff、运行测试并等待人工确认。",
          en: "Shows a user submitting a coding task while OpenHands creates a plan, produces a diff, runs tests, and waits for human review."
        },
        status: "planned",
        durationLabel: { zh: "约 4 分钟", en: "About 4 minutes" },
        transcript: [
          { zh: "连接测试仓库，输入要修复或新增的功能目标。", en: "Connect a test repo and enter the feature or fix goal." },
          { zh: "平台隔离运行 OpenHands，产出计划、代码 diff 和测试输出。", en: "The platform runs OpenHands in isolation and produces a plan, code diff, and test output." },
          { zh: "用户检查 diff、失败原因和审计记录，再决定是否采纳。", en: "The user reviews the diff, failure reasons, and audit record before accepting it." }
        ]
      }
    ]
  },
  {
    id: "platform-browser-use",
    source: "marketplace",
    name: "browser-use",
    vendor: "browser-use",
    seller: {
      kind: "platform",
      label: { zh: "browser-use 开源仓库", en: "browser-use open-source repo" },
      contextScale: {
        zh: "网页打开、点击、表单、跨站采集、远程浏览器和人工确认流程",
        en: "Page navigation, clicks, forms, cross-site collection, remote browser, and human approval workflow"
      }
    },
    intro: {
      zh: "browser-use 是面向 AI Agent 的浏览器自动化开源项目。平台第一阶段把它作为浏览器地图候选，用来让手机用户也能提交网页任务，由平台远程浏览器执行并回放结果。",
      en: "browser-use is an open-source browser automation project for AI agents. AgentLens treats it as a browser-map candidate so mobile users can submit web tasks, have the platform remote browser execute them, and review the result."
    },
    tagline: {
      zh: "把网页操作能力装进平台工作区",
      en: "Put web-operation capability inside the AgentLens workspace"
    },
    category: "Browser automation agent",
    tags: ["managed-runtime-candidate", "github", "browser", "automation", "web-agent", "playwright", "open-source", "mit"],
    scenarios: [scenario("browser-automation"), scenario("workflow-automation"), scenario("market-research")],
    unsuitableScenarios: [scenario("defi-trading"), scenario("security-audit")],
    recommendedFor: [
      { zh: "需要让 Agent 打开网页、读取内容、填表或做网页验证的用户", en: "Users who need an Agent to open pages, read content, fill forms, or verify web flows" },
      { zh: "希望手机上提交任务、平台远程浏览器代跑的非技术用户", en: "Non-technical users who want to submit tasks on mobile and let a remote browser run them" }
    ],
    riskLevel: "high",
    riskNotes: [
      { zh: "浏览器自动化可能触达登录态、表单提交、付款和账号设置，必须做权限确认。", en: "Browser automation can touch sessions, form submissions, payments, and account settings; approvals are mandatory." },
      { zh: "不能绕过验证码、付费墙、平台规则或用户授权边界。", en: "It must not bypass CAPTCHAs, paywalls, platform rules, or user authorization boundaries." }
    ],
    riskMitigation: [
      { zh: "默认使用隔离浏览器、白名单域名、只读模式和敏感动作二次确认。", en: "Default to isolated browsers, domain allowlists, read-only mode, and second confirmation for sensitive actions." },
      { zh: "每个网页动作都要保留步骤、截图或可回放记录。", en: "Every web action should keep steps, screenshots, or replayable records." }
    ],
    accessTypes: ["local", "cloud", "api"],
    complexity: "high",
    hasOnboardingGuide: false,
    docsUrl: "https://github.com/browser-use/browser-use",
    pricingHint: {
      zh: "待接浏览器地图后按浏览器会话时长、网页动作数和模型消耗折算积分。",
      en: "After browser-map integration, credits should be estimated by browser session time, action count, and model usage."
    },
    latestObservedAt: "2026-06-21",
    observationSummary: {
      zh: "第一批托管候选：适合浏览器地图，当前先补平台版商品卡，不替代外部 browser-use 收录条目。",
      en: "First-batch hosted candidate: fits the browser map; this adds the AgentLens hosted-candidate shelf card, not a replacement for the external browser-use listing."
    },
    buyerCard: {
      tasks: [
        { zh: "打开网页并提取关键信息", en: "Open pages and extract key information" },
        { zh: "执行表单和多步骤网页任务", en: "Run form and multi-step web tasks" },
        { zh: "回放网页操作过程", en: "Replay the browser action record" }
      ],
      deliverable: {
        zh: "网页任务结果、步骤记录、截图/回放、来源链接和敏感动作确认记录。",
        en: "A web-task result, step record, screenshots/replay, source links, and sensitive-action approval records."
      },
      notFor: {
        zh: "不适合绕过验证码、自动付款、无授权登录或违反网站规则的任务。",
        en: "Not for bypassing CAPTCHAs, automatic payments, unauthorized logins, or tasks that violate site rules."
      },
      runMode: {
        zh: "平台浏览器地图候选；下一步接远程浏览器、动作回放和敏感操作确认。",
        en: "Browser-map candidate; next step is remote browser runtime, action replay, and sensitive-action confirmation."
      },
      dataBoundary: {
        zh: "接通后网页任务进入平台远程浏览器；登录凭证和敏感提交必须由用户授权并最小化保存。",
        en: "After integration web tasks run in a platform remote browser; credentials and sensitive submissions require user approval and minimal retention."
      },
      differentiation: {
        zh: "它的价值是让 Agent 真正操作网页并留下回放证据，不是只总结网页内容。",
        en: "Its value is having an Agent operate real websites with replay evidence, not merely summarizing web pages."
      }
    },
    runtimeSecurity: {
      kind: "external_tool",
      label: { zh: "开源仓库待托管", en: "Open-source repo pending hosting" },
      description: {
        zh: "已选入托管候选，但远程浏览器运行器、权限确认和回放尚未接通。",
        en: "Selected as a hosted candidate, but remote browser runtime, approvals, and replay are not connected yet."
      },
      evidenceLabel: { zh: "待托管", en: "Pending hosting" }
    },
    capabilityContract: {
      mapFit: "browser",
      inputTypes: ["text", "url", "image", "file"],
      outputTypes: ["workflow", "report", "table", "file"],
      requiredTools: ["model", "web-search", "web-fetch", "ocr", "browser", "remote-runtime", "audit-log"],
      runtimeMode: "managed-runtime",
      mobileSupport: "partial",
      desktopSupport: "partial",
      permissionNeeds: ["browser-session", "login", "submit-form", "payment", "external-account"],
      pricingMode: "per-tool",
      trustSignals: ["audit", "reputation", "sample-output"],
      knownLimits: [
        { zh: "付款、提交表单、登录和账号设置必须二次确认。", en: "Payments, form submissions, logins, and account settings require second confirmation." },
        { zh: "不能绕过验证码、付费墙、网站规则或用户授权边界。", en: "It must not bypass CAPTCHAs, paywalls, site rules, or user authorization boundaries." }
      ],
      typicalTasks: [
        { zh: "打开指定网页并提取关键信息", en: "Open a target website and extract key information" },
        { zh: "自动填写表单并等待人工确认提交", en: "Auto-fill a form and wait for human approval before submitting" },
        { zh: "回放网页操作步骤并生成执行记录", en: "Replay web operation steps and produce an execution log" }
      ]
    },
    demoVideos: [
      {
        title: {
          zh: "3 分钟：手机提交网页任务，远程浏览器回放",
          en: "3 min: mobile web task with remote browser replay"
        },
        summary: {
          zh: "演示用户在手机上输入网页任务，browser-use 打开远程浏览器执行读取、点击和表单步骤，并返回截图/回放。",
          en: "Shows a mobile user submitting a web task while browser-use drives a remote browser, performs read/click/form steps, and returns screenshots or replay."
        },
        status: "planned",
        durationLabel: { zh: "约 3 分钟", en: "About 3 minutes" },
        transcript: [
          { zh: "输入目标网址和任务，例如读取页面、比较价格或填写非敏感表单。", en: "Enter a target URL and task, such as reading a page, comparing prices, or filling a non-sensitive form." },
          { zh: "平台远程浏览器逐步执行，并在敏感动作前请求确认。", en: "The remote browser executes step by step and asks for confirmation before sensitive actions." },
          { zh: "用户查看任务结果、来源链接、截图和可回放的操作记录。", en: "The user reviews the result, source links, screenshots, and replayable action records." }
        ]
      }
    ]
  }
];
