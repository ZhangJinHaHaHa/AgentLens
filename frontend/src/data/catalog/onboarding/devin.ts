import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "devin",
  prerequisites: [
    { zh: "已经联系 Cognition 拿到 Devin 团队席位（暂未完全开放自助）。", en: "Coordinate with Cognition to provision a Devin team seat (full self-serve isn't open everywhere yet)." },
    { zh: "准备一个 staging 仓库 + 受限 GitHub App 用作沙盒。", en: "A staging repo + restricted GitHub App you can hand to the sandbox." },
    { zh: "团队对 PR 流程有共识，知道每次 review 谁负责。", en: "Team agreement on PR ownership for whatever Devin opens." }
  ],
  firstStep: {
    zh: "在 Devin 控制台里把 staging 仓库连上，然后让 Devin 跑一个明确的“小任务”——比如一个 typo 修复 PR。",
    en: "Connect the staging repo inside Devin and have it run a tightly-scoped task first — e.g. opening a typo-fix PR."
  },
  steps: [
    {
      title: { zh: "Workspace 配置", en: "Workspace config" },
      body: {
        zh: "在 Workspace Setup 里写出 build / test 命令，禁掉无关的 npm script，避免 Devin 走偏。",
        en: "In Workspace Setup, declare build/test commands and disable unrelated npm scripts to keep Devin on-rails."
      }
    },
    {
      title: { zh: "权限边界", en: "Permission boundaries" },
      body: {
        zh: "用 GitHub App restricted scope，只允许在 develop 分支推送、不允许直接动 main。",
        en: "Use a restricted GitHub App: allow pushes to `develop`, forbid direct writes to `main`."
      }
    },
    {
      title: { zh: "用 Playbook 组织重复任务", en: "Use Playbooks for repeats" },
      body: {
        zh: "把常见任务模板成 Playbook，团队就能用同样的“任务说明书”反复触发。",
        en: "Template recurring work as Playbooks so anyone on the team triggers them with the same brief."
      }
    },
    {
      title: { zh: "建立观察窗口", en: "Set up observation" },
      body: {
        zh: "前两周每个 PR 都要人审 + 看 Devin 的 plan 日志，确认它对失败任务能否自我纠错。",
        en: "Watch every PR for the first two weeks and read Devin's plan logs to confirm it can self-correct on failures."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Devin 文档", en: "Devin docs" }, url: "https://docs.devin.ai" },
    { label: { zh: "Devin Playbooks", en: "Devin Playbooks" }, url: "https://docs.devin.ai/essential-guidelines/playbooks" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议第一阶段把 Devin 当“高级实习生”：只委托明确范围的任务，自动化前先收 30 个 PR 的成功率统计。",
    en: "AgentLens advice: treat Devin as a senior intern at first. Only delegate well-scoped tasks, and gather success metrics across the first 30 PRs before automating further."
  },
  commonPitfalls: [
    { zh: "把模糊需求“随便跑一下”，token 成本爆炸。", en: "Throwing vague tasks at Devin and watching the token bill explode." },
    { zh: "PR 自动合并未配人审，遇到 silent regression。", en: "Auto-merging Devin PRs with no human review and shipping silent regressions." }
  ]
};
