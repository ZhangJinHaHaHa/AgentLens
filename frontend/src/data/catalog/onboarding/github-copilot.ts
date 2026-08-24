import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * GitHub Copilot 指南聚焦“已有 IDE 和仓库内提速”，依据 GitHub 官方产品与文档整理，输出是
 * 安装登录、约束 Chat 范围、补测试并本地验证的渐进式详情内容，而非完整外包开发流程。
 * github-copilot 是跨目录持久 id，不能因订阅层级、IDE 扩展拆分或功能名称变化单独调整。
 * 数组次序刻意让小范围解释先于生成和采纳代码，详情页编号与风险列表都应保留编辑顺序。
 * 本文件不检查席位、不安装扩展、不读取组织策略，也不接受或执行任何生成补丁；代码引用策略、
 * 公共代码建议和数据权限由 GitHub/企业管理员控制。认证失败、IDE 不受支持或测试不通过时，
 * 正确边界是停止在实际工具链，不得因静态指南可见而标记任务完成。
 */
export const guide: OnboardingGuide = {
  agentId: "github-copilot",
  prerequisites: [
    { zh: "一个 GitHub 账号，以及可用的 Copilot 个人、商业或企业订阅。", en: "A GitHub account and an active Copilot Individual, Business or Enterprise subscription." },
    { zh: "VS Code、JetBrains、Visual Studio 或 Neovim 这类受支持 IDE。", en: "A supported IDE such as VS Code, JetBrains, Visual Studio or Neovim." },
    { zh: "准备一个非生产仓库做第一次测试，避免把真实客户代码直接拿来试。", en: "Use a non-production repository for the first test instead of real customer code." }
  ],
  firstStep: {
    zh: "先在 VS Code 安装 GitHub Copilot 扩展，登录 GitHub，然后用一个小任务测试补全、聊天和解释代码三种能力。",
    en: "Install the GitHub Copilot extension in VS Code, sign in with GitHub, then test completions, chat and code explanation on a small task."
  },
  steps: [
    {
      title: { zh: "打开 IDE 集成", en: "Enable the IDE integration" },
      body: {
        zh: "安装扩展后确认 Copilot 状态为 enabled。第一次不要直接让它改大文件，先让它解释函数或生成一个小测试。",
        en: "After installing the extension, confirm Copilot is enabled. Start with explaining a function or generating a small test rather than broad file rewrites."
      }
    },
    {
      title: { zh: "用 Chat 明确任务边界", en: "Use Chat with clear scope" },
      body: {
        zh: "把需求写成“只修改这个文件、保留现有 API、先给 diff”这类约束，减少它跨文件猜测。",
        en: "Phrase prompts with constraints like: only edit this file, keep the current API, show a diff first. This reduces broad guessing."
      }
    },
    {
      title: { zh: "让它补测试而不是只补代码", en: "Ask for tests, not just code" },
      body: {
        zh: "Copilot 最适合在你已有上下文里补单元测试、边界输入和样例调用；生成后仍要跑本地测试。",
        en: "Copilot is strongest when adding unit tests, edge cases and example calls inside your existing context. Always run local tests afterward."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "GitHub Copilot 首页", en: "GitHub Copilot home" }, url: "https://github.com/features/copilot" },
    { label: { zh: "GitHub Copilot 文档", en: "GitHub Copilot docs" }, url: "https://docs.github.com/copilot" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：Copilot 适合“在已有仓库里提速”，不是完整外包开发。企业团队先检查代码引用策略、组织权限和是否允许使用公共代码建议。",
    en: "AgentLens advice: Copilot speeds up work inside an existing repo; it is not a full outsourcing layer. Enterprise teams should review code reference policy, org permissions and public-code suggestion settings."
  },
  commonPitfalls: [
    { zh: "接受大段生成代码但不跑测试，容易把旧 API 或隐含假设带进仓库。", en: "Accepting large generated patches without tests can import stale APIs or hidden assumptions." },
    { zh: "把密钥、客户样本、内部错误日志直接贴进聊天。", en: "Pasting secrets, customer samples or internal error logs directly into chat." }
  ]
};
