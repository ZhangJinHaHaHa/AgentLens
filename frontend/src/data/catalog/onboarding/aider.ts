import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * 这是一份面向“本地仓库 + Git 提交”工作方式的 Aider 编辑指南，依据 Aider 官方安装与模型文档
 * 整理，最终在详情页按前置条件、首步、编号步骤、风险和官方链接分栏展示。
 * agentId=aider 是与精选卡及详情路由对接的稳定键，不随 CLI 包名或默认模型变化；步骤顺序刻意从
 * 安装、选模推进到 Git 约束和 architect 模式，调整顺序会改变用户看到的操作流程。
 * codeBlock 会作为原始命令文本呈现，本文件不负责执行 pipx、检查 API Key、创建分支或阻止自动提交。
 * 安装器缺失、模型不可用、工作区不干净均属于外部执行失败；官方命令变化则是需要人工更新的
 * 内容时效问题，不能通过在数据层猜测平台或版本来静默改写指令。
 */
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
