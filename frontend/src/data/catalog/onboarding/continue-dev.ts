import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * Continue 指南覆盖 IDE 插件、可替换模型和团队级配置三者的组合，来源是 Continue 文档与 Hub，
 * 输出给详情页的是一条从试用到自有模型、规则包、权限审计和指标观察的有序迁移路径。
 * continue-dev 是既有公开 id；它与产品展示名 Continue 解耦，改名会中断 curated 卡到指南 Map 的关联。
 * YAML codeBlock 作为原始示例显示，字段和步骤次序不可被组件自动排序，否则会先谈指标再完成权限配置。
 * 这里不解析 config.yaml、不验证 provider endpoint、不存储密钥，也不采集 acceptance rate。
 * 配置语法漂移、模型端点不可达或本地推理资源不足属于外部失败；尤其不得为了“可用”在数据文件中
 * 嵌入真实凭证或根据环境动态改写示例。
 */
export const guide: OnboardingGuide = {
  agentId: "continue-dev",
  prerequisites: [
    { zh: "VS Code / JetBrains 任选其一。", en: "VS Code or a JetBrains IDE." },
    { zh: "至少一个可用模型——OpenAI / Anthropic / 自托管 vLLM 都行。", en: "At least one model: OpenAI, Anthropic, or self-hosted vLLM." },
    { zh: "对自部署感兴趣的团队建议先准备 GPU 节点和 observability 工具。", en: "If you plan to self-host, line up GPU nodes and observability up front." }
  ],
  firstStep: {
    zh: "在 IDE 插件市场搜 “Continue” 安装，第一次启动选 Free trial 跑通。",
    en: "Install the Continue extension from your IDE marketplace and run through the free-trial wizard."
  },
  steps: [
    {
      title: { zh: "切换到自有模型", en: "Switch to your own model" },
      body: {
        zh: "config.yaml 里替换 default model 为 OpenAI / Anthropic / 自部署 endpoint。",
        en: "Replace the default model in `config.yaml` with OpenAI, Anthropic or your hosted endpoint."
      },
      codeBlock: "models:\n  - name: claude-4\n    provider: anthropic\n    model: claude-4-opus"
    },
    {
      title: { zh: "维护 prompts/rules", en: "Curate prompts/rules" },
      body: {
        zh: "通过 hub.continue.dev 的 packs 拉取代码规范、PR 模板，再 fork 一份给自己改。",
        en: "Pull packs from hub.continue.dev for code conventions / PR templates, then fork one for your team."
      }
    },
    {
      title: { zh: "做权限审计", en: "Audit permissions" },
      body: {
        zh: "把 Continue 的工具调用 (terminal/run) 默认设为 ask，关键脚本不允许自动跑。",
        en: "Set Continue's tool calls (terminal/run) to 'ask' so critical scripts never auto-run."
      }
    },
    {
      title: { zh: "建议性指标观察", en: "Watch suggestion metrics" },
      body: {
        zh: "用 hub.continue.dev 的 metrics 看每个模型的 acceptance rate，再据此调整路由。",
        en: "Track acceptance rates per model in hub.continue.dev and adjust your routing accordingly."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Continue 文档", en: "Continue docs" }, url: "https://docs.continue.dev" },
    { label: { zh: "Continue Hub", en: "Continue hub" }, url: "https://hub.continue.dev" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议团队层面只维护一份 config.yaml，并放进基础设施仓库；防止每位同事自己改导致结果不一致。",
    en: "AgentLens advice: keep a single team `config.yaml` in your infra repo so individual tweaks don't drift."
  },
  commonPitfalls: [
    { zh: "config.yaml 错把 secret 写进版本控制。", en: "Committing secrets into config.yaml." },
    { zh: "本地模型推理慢就关掉 Continue，错失它真正的价值（自定义 + 私有）。", en: "Turning off Continue when local inference feels slow — and missing the point (customisation + privacy)." }
  ]
};
