import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "aider",
  prerequisites: [
    { zh: "本地装好 Python 3.10+ 与 git。", en: "Local Python 3.10+ and git." },
    { zh: "至少一个模型 API key（OpenAI / Anthropic / DeepSeek 都支持）。", en: "At least one model API key (OpenAI/Anthropic/DeepSeek all work)." }
  ],
  firstStep: {
    zh: "用 pipx 安装并在仓库里跑 `aider` 进入 REPL。",
    en: "Install with pipx and run `aider` inside your repo to enter the REPL."
  },
  steps: [
    {
      title: { zh: "安装", en: "Install" },
      body: {
        zh: "推荐 pipx 安装，避免污染全局 Python。",
        en: "Use pipx so global Python stays clean."
      },
      codeBlock: "pipx install aider-chat"
    },
    {
      title: { zh: "选择模型", en: "Choose a model" },
      body: {
        zh: "默认是 OpenAI o-series，可以加 `--model anthropic/claude-4-sonnet` 切到 Claude。",
        en: "Defaults to OpenAI o-series. Use `--model anthropic/claude-4-sonnet` to switch to Claude."
      }
    },
    {
      title: { zh: "约定 git 工作流", en: "Set the git rhythm" },
      body: {
        zh: "Aider 默认每次改动都 commit；建议先创分支再跑，别在 main 上裸跑。",
        en: "Aider commits each edit by default — branch first, never run on main."
      }
    },
    {
      title: { zh: "用 architect 模式做大改动", en: "Use architect mode for big changes" },
      body: {
        zh: "执行 `/architect` 让模型先写计划再动手；适合重构类任务。",
        en: "`/architect` makes Aider plan before editing — best for refactors."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Aider 文档", en: "Aider docs" }, url: "https://aider.chat/docs" },
    { label: { zh: "模型对比", en: "Model leaderboard" }, url: "https://aider.chat/docs/leaderboards" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议在 monorepo 里做 .aider.conf.yml，限定 Aider 只能看哪些子项目，避免它一次性扫描所有源码。",
    en: "AgentLens advice: in monorepos drop a `.aider.conf.yml` that scopes Aider to specific subpackages so it doesn't scan everything."
  },
  commonPitfalls: [
    { zh: "默认 commit 配 force push 习惯，意外覆盖远端历史。", en: "Auto commit + a force-push habit will eventually overwrite remote history." },
    { zh: "把 chat history 复制到外部文档，泄露私有代码片段。", en: "Pasting chat history elsewhere leaks proprietary code snippets." }
  ]
};
