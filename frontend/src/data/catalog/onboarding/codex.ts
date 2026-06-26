import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "codex",
  prerequisites: [
    { zh: "一个可用的 OpenAI / 中转站模型额度，正式上线后优先切官方 OpenAI Key。", en: "Usable OpenAI or relay model quota; switch to official OpenAI keys when production keys are ready." },
    { zh: "要处理的仓库必须有干净分支、测试命令和回滚方式。", en: "The target repo needs a clean branch, test command, and rollback path." },
    { zh: "平台代码沙箱、Git 授权和命令审计要先接好。", en: "AgentLens should connect code sandboxing, Git authorization, and command audit first." }
  ],
  firstStep: {
    zh: "先用只读任务测试：让 Codex 解释一个小仓库的目录、风险点和下一步修改计划，不直接写文件。",
    en: "Start read-only: ask Codex to explain a small repo's structure, risks, and next edit plan without writing files."
  },
  steps: [
    {
      title: { zh: "连接模型额度", en: "Connect model quota" },
      body: {
        zh: "上线前可走平台中转站；拿到官方 OpenAI Key 后，再切换到官方工具链和更强模型配置。",
        en: "Use the relay before launch; once official OpenAI keys are available, switch to the official toolchain and stronger model configuration."
      }
    },
    {
      title: { zh: "限定代码沙箱", en: "Scope the code sandbox" },
      body: {
        zh: "只允许访问授权仓库、临时分支和白名单命令，禁止默认改主分支。",
        en: "Allow only authorized repos, temporary branches, and allowlisted commands. Never edit main by default."
      }
    },
    {
      title: { zh: "输出 diff 和测试证据", en: "Return diff and test evidence" },
      body: {
        zh: "每次执行都要保存计划、diff、测试输出、失败原因和人工确认状态。",
        en: "Every run should save the plan, diff, test output, failure reason, and approval state."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "OpenAI Codex", en: "OpenAI Codex" }, url: "https://openai.com/codex" },
    { label: { zh: "Codex 开发者文档", en: "Codex developer docs" }, url: "https://developers.openai.com/codex/" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：Codex 不要做成“手机上直接改代码”的错觉，而是做成手机发起、云端沙箱执行、前端看 diff 和测试证据。",
    en: "AgentLens advice: do not pretend Codex edits code directly on the phone. Make it mobile-started, cloud-sandboxed, with diff and test evidence in the UI."
  },
  commonPitfalls: [
    { zh: "只接模型 API，却没有文件系统、测试命令和 diff 审计，最后会退化成普通聊天。", en: "Connecting only the model API without filesystem, tests, and diff audit reduces it to generic chat." },
    { zh: "让它默认写生产分支或读未授权私有仓库。", en: "Letting it write production branches or read unauthorized private repos." }
  ]
};
