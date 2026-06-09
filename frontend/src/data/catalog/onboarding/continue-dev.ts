import type { OnboardingGuide } from "@/domain/onboarding";

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
