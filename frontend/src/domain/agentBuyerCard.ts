import type { I18nText } from "./i18nText";
import { getAgentProductType, getRuntimeSecurity, type AgentCatalogEntry } from "./catalog";

export interface AgentBuyerCardSummary {
  outcome: I18nText;
  bestFor: I18nText;
  tasks: I18nText[];
  deliverable: I18nText;
  notFor: I18nText;
  runMode: I18nText;
  dataBoundary: I18nText;
  differentiation: I18nText;
}

const OUTCOME_BY_PRODUCT_TYPE: Record<ReturnType<typeof getAgentProductType>, I18nText> = {
  marketplace_agent: {
    zh: "买的是一个已经打包好的 Agent 服务，重点看它背后的卖家经验、可用状态和审计记录。",
    en: "A packaged Agent service. Judge it by seller expertise, availability, and audit evidence."
  },
  large_model_assistant: {
    zh: "适合问答、写作、资料分析和多模态理解，属于通用型 AI 助手。",
    en: "A general AI assistant for Q&A, writing, document analysis, and multimodal work."
  },
  agent_platform: {
    zh: "适合搭建自己的 Agent、知识库或工作流，不是单一任务机器人。",
    en: "Useful for building your own Agents, knowledge bases, or workflows rather than one fixed bot."
  },
  workflow_agent: {
    zh: "适合把表单、通知、审批、网页操作和外部工具串成自动化流程。",
    en: "Useful for turning forms, notifications, approvals, web actions, and tools into workflows."
  },
  coding_agent: {
    zh: "适合改代码、修 Bug、读仓库和做研发任务，通常需要给项目或编辑器权限。",
    en: "Useful for coding, bug fixes, repo reading, and engineering tasks; usually needs project or IDE access."
  },
  vertical_ai_tool: {
    zh: "面向某个具体业务场景的专用 AI 工具，先确认它的场景是否正好匹配你的需求。",
    en: "A specialist AI tool for a specific workflow. First check whether its use case matches your need."
  }
};

const TASKS_BY_PRODUCT_TYPE: Record<ReturnType<typeof getAgentProductType>, I18nText[]> = {
  marketplace_agent: [
    { zh: "提交真实业务问题", en: "Submit a real business problem" },
    { zh: "拿到专家化交付物", en: "Receive an expert-style deliverable" },
    { zh: "查看平台审计记录", en: "Review platform audit evidence" }
  ],
  large_model_assistant: [
    { zh: "写作与改稿", en: "Writing and editing" },
    { zh: "资料分析", en: "Material analysis" },
    { zh: "多轮问答", en: "Multi-turn Q&A" }
  ],
  agent_platform: [
    { zh: "创建自己的 Agent", en: "Create your own Agent" },
    { zh: "搭建知识库", en: "Build a knowledge base" },
    { zh: "发布工作流应用", en: "Publish workflow apps" }
  ],
  workflow_agent: [
    { zh: "串联表单和通知", en: "Connect forms and notifications" },
    { zh: "自动处理网页任务", en: "Automate web tasks" },
    { zh: "生成执行记录", en: "Generate execution logs" }
  ],
  coding_agent: [
    { zh: "读取仓库", en: "Read repositories" },
    { zh: "生成代码补丁", en: "Generate code patches" },
    { zh: "审查和修复 Bug", en: "Review and fix bugs" }
  ],
  vertical_ai_tool: [
    { zh: "完成垂类任务", en: "Complete specialist tasks" },
    { zh: "生成场景化结果", en: "Generate scenario-specific output" },
    { zh: "减少重复操作", en: "Reduce repetitive work" }
  ]
};

const DELIVERABLE_BY_PRODUCT_TYPE: Record<ReturnType<typeof getAgentProductType>, I18nText> = {
  marketplace_agent: {
    zh: "一份由卖家专业经验驱动的分析、报告、方案或自动化结果。",
    en: "An analysis, report, plan, or automated result backed by seller expertise."
  },
  large_model_assistant: {
    zh: "答案、草稿、摘要、结构化分析或可继续编辑的内容。",
    en: "Answers, drafts, summaries, structured analysis, or editable content."
  },
  agent_platform: {
    zh: "可运行的 Agent、知识库、应用配置、工作流草案或发布记录。",
    en: "Runnable Agents, knowledge bases, app configs, workflow drafts, or publish records."
  },
  workflow_agent: {
    zh: "自动化流程、节点结果、审批记录、通知或外部系统动作。",
    en: "Automations, node results, approval logs, notifications, or external actions."
  },
  coding_agent: {
    zh: "代码解释、补丁建议、风险清单、测试计划或仓库修改方案。",
    en: "Code explanations, patch suggestions, risk lists, test plans, or repo-change plans."
  },
  vertical_ai_tool: {
    zh: "面向具体场景的报告、素材、建议、表格或任务结果。",
    en: "Scenario-specific reports, assets, recommendations, tables, or task results."
  }
};

const NOT_FOR_BY_PRODUCT_TYPE: Record<ReturnType<typeof getAgentProductType>, I18nText> = {
  marketplace_agent: {
    zh: "不适合没有明确业务材料、只想随便闲聊的任务。",
    en: "Not ideal for vague chats without concrete business material."
  },
  large_model_assistant: {
    zh: "不适合需要它直接控制官方 App、桌面软件或真实账号的任务。",
    en: "Not ideal when it must directly control official apps, desktop software, or real accounts."
  },
  agent_platform: {
    zh: "不适合只想问一句答案、完全不想配置应用或流程的用户。",
    en: "Not ideal for users who only need one answer and do not want app or workflow setup."
  },
  workflow_agent: {
    zh: "不适合没有稳定流程、凭证或外部系统权限的任务。",
    en: "Not ideal without a stable process, credentials, or external-system access."
  },
  coding_agent: {
    zh: "不适合不能提供仓库、代码片段或工程上下文的任务。",
    en: "Not ideal without a repository, code snippet, or engineering context."
  },
  vertical_ai_tool: {
    zh: "不适合超出它垂直场景边界的通用工作。",
    en: "Not ideal for broad work outside its specialist domain."
  }
};

const DIFFERENTIATION_BY_PRODUCT_TYPE: Record<ReturnType<typeof getAgentProductType>, I18nText> = {
  marketplace_agent: {
    zh: "价值在卖家的私有经验、交付流程和平台可信记录，不只是模型回答。",
    en: "Its value is seller expertise, delivery workflow, and trust evidence, not just model text."
  },
  large_model_assistant: {
    zh: "价值在通用推理和多模态能力；平台工作区会继续补文件、联网和工具链。",
    en: "Its value is broad reasoning and multimodal capability; AgentLens adds files, web, and tools."
  },
  agent_platform: {
    zh: "价值在能把模型变成可发布的 Agent、知识库或工作流。",
    en: "Its value is turning models into publishable Agents, knowledge bases, or workflows."
  },
  workflow_agent: {
    zh: "价值在自动执行多步流程、连接工具和留下可回放记录。",
    en: "Its value is executing multi-step workflows, connecting tools, and leaving replayable logs."
  },
  coding_agent: {
    zh: "价值在理解项目上下文、操作仓库和形成可检查的代码变更。",
    en: "Its value is understanding project context, working with repos, and producing reviewable changes."
  },
  vertical_ai_tool: {
    zh: "价值在垂直场景、专用数据、格式化交付物或专门工具。",
    en: "Its value is specialist context, dedicated data, formatted deliverables, or purpose-built tools."
  }
};

export function buildAgentBuyerCardSummary(entry: AgentCatalogEntry): AgentBuyerCardSummary {
  const productType = getAgentProductType(entry);
  const firstRecommendation = entry.recommendedFor[0];
  const scenarioLabels = entry.scenarios.slice(0, 2).map((scenario) => scenario.label);

  return {
    outcome: entry.tagline ?? OUTCOME_BY_PRODUCT_TYPE[productType],
    bestFor:
      firstRecommendation ??
      buildScenarioFallback(scenarioLabels) ??
      OUTCOME_BY_PRODUCT_TYPE[productType],
    tasks: entry.buyerCard?.tasks ?? buildTaskLabels(entry, productType),
    deliverable: entry.buyerCard?.deliverable ?? DELIVERABLE_BY_PRODUCT_TYPE[productType],
    notFor: entry.buyerCard?.notFor ?? buildNotFor(entry, productType),
    runMode: entry.buyerCard?.runMode ?? buildRunMode(entry, productType),
    dataBoundary: entry.buyerCard?.dataBoundary ?? buildDataBoundary(entry, productType),
    differentiation: entry.buyerCard?.differentiation ?? DIFFERENTIATION_BY_PRODUCT_TYPE[productType]
  };
}

function buildScenarioFallback(scenarios: I18nText[]): I18nText | null {
  if (scenarios.length === 0) return null;
  return {
    zh: `适合：${scenarios.map((scenario) => scenario.zh).join("、")}`,
    en: `Best for: ${scenarios.map((scenario) => scenario.en).join(", ")}`
  };
}

function buildTaskLabels(entry: AgentCatalogEntry, productType: ReturnType<typeof getAgentProductType>): I18nText[] {
  const scenarios = entry.scenarios.slice(0, 3).map((scenario) => scenario.label);
  return scenarios.length > 0 ? scenarios : TASKS_BY_PRODUCT_TYPE[productType];
}

function buildNotFor(entry: AgentCatalogEntry, productType: ReturnType<typeof getAgentProductType>): I18nText {
  const unsuitable = entry.unsuitableScenarios.slice(0, 2).map((scenario) => scenario.label);
  if (unsuitable.length === 0) return NOT_FOR_BY_PRODUCT_TYPE[productType];
  return {
    zh: `不适合：${unsuitable.map((scenario) => scenario.zh).join("、")}`,
    en: `Not ideal for: ${unsuitable.map((scenario) => scenario.en).join(", ")}`
  };
}

function buildRunMode(entry: AgentCatalogEntry, productType: ReturnType<typeof getAgentProductType>): I18nText {
  const runtime = getRuntimeSecurity(entry);
  const access = new Set(entry.accessTypes);

  if (runtime.kind === "platform_image" || entry.source === "native") {
    return {
      zh: "平台云端受控运行，适合进入 AgentLens 工作区执行。",
      en: "Runs in the AgentLens controlled cloud runtime and can fit the workspace path."
    };
  }

  if (entry.source === "marketplace") {
    return {
      zh: "卖家服务或镜像待接入平台，平台负责租赁、计费和可信记录。",
      en: "Seller service or image pending platform runtime; AgentLens handles rental, metering, and trust records."
    };
  }

  if (productType === "large_model_assistant") {
    return {
      zh: "通过平台模型网关使用；官方客户端能力和平台工作区能力需要分开说明。",
      en: "Used through the platform model gateway; official-client and workspace capabilities are shown separately."
    };
  }

  if (access.has("api") && access.has("saas")) {
    return {
      zh: "官方 SaaS/API 优先；平台接入适配器后可在工作区运行。",
      en: "Official SaaS/API first; once an adapter is connected it can run inside the workspace."
    };
  }

  if (access.has("local") || access.has("cli")) {
    return {
      zh: "偏本地或桌面运行；手机端需要平台工作区替代关键能力。",
      en: "Primarily local or desktop; mobile needs the workspace to substitute key capabilities."
    };
  }

  if (access.has("saas")) {
    return {
      zh: "主要在官方云端运行；平台可做使用指导、跳转或后续适配。",
      en: "Primarily runs in the official cloud; AgentLens can guide, jump out, or add adapters later."
    };
  }

  return {
    zh: "运行方式待确认，暂不承诺平台内完整可用。",
    en: "Runtime path still needs confirmation; full in-platform availability is not promised yet."
  };
}

function buildDataBoundary(entry: AgentCatalogEntry, productType: ReturnType<typeof getAgentProductType>): I18nText {
  const runtime = getRuntimeSecurity(entry);
  const access = new Set(entry.accessTypes);

  if (runtime.kind === "platform_image" || entry.source === "native") {
    return {
      zh: "任务数据进入平台运行区，保留计费、审计和信誉事件。",
      en: "Task data enters the platform runtime with metering, audit, and reputation events."
    };
  }

  if (entry.source === "marketplace") {
    return {
      zh: "任务可能进入卖家运行环境；平台应记录租赁、用量和争议证据。",
      en: "Tasks may enter the seller runtime; AgentLens should record rental, usage, and dispute evidence."
    };
  }

  if (productType === "large_model_assistant") {
    return {
      zh: "请求会经平台模型网关发送给模型提供方；不要输入不该外发的敏感信息。",
      en: "Requests route through the platform model gateway to model providers; do not enter sensitive data that should not leave."
    };
  }

  if (access.has("api") || access.has("saas")) {
    return {
      zh: "接入后数据会发送到官方或外部 SaaS API，平台保存最小化运行记录。",
      en: "Once connected, data is sent to the official or external SaaS API; AgentLens stores minimal run records."
    };
  }

  return {
    zh: "数据边界待确认，正式上架前必须补齐说明。",
    en: "Data boundary is not confirmed yet and must be documented before listing."
  };
}
