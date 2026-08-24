import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * Fin 指南面向已有 Intercom 工作区和帮助中心的客服团队，依据官方 Fin/知识库资料整理，
 * 输出是一条从内容治理、品牌口吻到解答率观察与人工升级的上线顺序。
 * intercom-fin 是目录与指南注册共用的稳定 id，不能随 Fin 套餐、计费单位或控制台栏目改名。
 * 详情页会按数组原序编号，因此知识库质量必须先于自动化指标和路由；文中的样本量与解答率只作
 * 运营评估参考，不是平台 SLA。该数据不读取真实会话、不训练知识库、不配置路由，也不计算费用。
 * 帮助文章过期、无法回答或升级规则缺失时，真实系统应转人工或失败；若官方指标定义/界面变化，
 * 应经内容复核更新，不能让前端根据这份快照推断客户问题已被解决。
 */
export const guide: OnboardingGuide = {
  agentId: "intercom-fin",
  prerequisites: [
    { zh: "已有 Intercom 工作区（Fin 是 Intercom 平台的一个 AI 层）。", en: "An existing Intercom workspace — Fin is an AI layer inside the Intercom platform." },
    { zh: "帮助中心已有一定数量的高质量文章（建议至少 20 篇覆盖常见问题）。", en: "A populated help centre with quality articles — at least 20 covering your most common questions is a good baseline." },
    { zh: "确定 Fin 回答不了时的降级策略（转人工 / 发工单）。", en: "Define a fallback policy for unanswered questions — route to a human agent or create a ticket." }
  ],
  firstStep: {
    zh: "在 Intercom 控制台进入 Fin AI Agent，连接你的帮助中心知识库，开启 Fin 并在测试环境里跑 10-20 个典型客服问题验证覆盖率。",
    en: "In the Intercom console, open Fin AI Agent, connect your help centre, enable Fin and run 10–20 typical support queries in the test environment to measure coverage."
  },
  steps: [
    {
      title: { zh: "优化知识库质量", en: "Improve your knowledge base quality" },
      body: {
        zh: "Fin 的回答质量直接取决于帮助中心文章。先清理过时内容，把最常见的 30 个问题写成独立文章，每篇 200-400 字，标题直接用问题句式。",
        en: "Fin's quality tracks your help centre content directly. Archive stale articles; write standalone articles for your 30 most common questions — 200–400 words each, with the question itself as the title."
      }
    },
    {
      title: { zh: "设置品牌口吻", en: "Set your brand tone" },
      body: {
        zh: "在 Fin 设置里配置回复语气（正式 / 友好 / 简洁），并添加禁用词和强制回答模板，保持品牌一致性。",
        en: "In Fin settings configure reply tone (formal / friendly / concise), add restricted topics and required response templates to keep brand voice consistent."
      }
    },
    {
      title: { zh: "监控解答率并迭代", en: "Monitor resolution rate and iterate" },
      body: {
        zh: "上线后重点看 Resolution Rate（Fin 完整解决的对话比例）。通常首周在 30-50%，经过 2-4 周内容迭代可到 60-80%。",
        en: "After launch, watch Resolution Rate — the percentage of conversations Fin fully resolves. Typically 30–50% in week one, rising to 60–80% after 2–4 rounds of content iteration."
      }
    },
    {
      title: { zh: "配置自动升级路径", en: "Configure escalation paths" },
      body: {
        zh: "对 Fin 无法回答的对话，设置自动标签 + 路由规则，把高价值或紧急对话优先分配给真人坐席。",
        en: "For conversations Fin can't resolve, set automatic tags and routing rules so high-value or urgent threads go to human agents first."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Fin AI Agent 文档", en: "Fin AI Agent docs" }, url: "https://www.intercom.com/help/en/articles/8205718" },
    { label: { zh: "知识库优化指南", en: "Help centre optimisation guide" }, url: "https://www.intercom.com/help/en/articles/6335243" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：上线前做一轮人工抽查，拿 100 条真实客服对话让 Fin 重新作答，对比真人答案，发现知识空白再补充文章，再上线。",
    en: "AgentLens advice: before going live, run 100 real support conversations through Fin in test mode and compare with human answers — fill the knowledge gaps you find, then launch."
  },
  commonPitfalls: [
    { zh: "帮助中心内容太少或太陈旧直接上线，导致 Fin 高频产生错误答案。", en: "Going live with a sparse or outdated help centre — Fin will hallucinate or give wrong answers at high frequency." },
    { zh: "没有设置降级路径，导致 Fin 无法解答时对话陷入僵局。", en: "No escalation path configured — conversations get stuck when Fin can't answer." }
  ]
};
