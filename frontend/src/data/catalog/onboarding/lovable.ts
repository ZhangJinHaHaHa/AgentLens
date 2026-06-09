import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "lovable",
  prerequisites: [
    { zh: "想清楚 MVP 想验证哪个核心假设——Lovable 强在快，但你要能定义“成功”。", en: "Clarify the single hypothesis your MVP needs to test — Lovable is fast but you must define 'success'." },
    { zh: "提前准备好 Supabase 账号（默认数据库）。", en: "Have a Supabase account ready — it is the default database." }
  ],
  firstStep: {
    zh: "去 lovable.dev 创建项目，先描述 “给 X 用户做一个 Y 功能的 MVP”，得到第一个原型。",
    en: "Create a project on lovable.dev with a single brief like 'MVP for X audience that does Y'. Lovable will scaffold the first prototype."
  },
  steps: [
    {
      title: { zh: "迭代界面", en: "Iterate the UI" },
      body: {
        zh: "用自然语言改界面：“header 加一个 CTA 按钮”、“移动端要堆叠布局”。",
        en: "Iterate UI in natural language: 'add a CTA in the header', 'stack the layout on mobile'."
      }
    },
    {
      title: { zh: "接 Supabase", en: "Connect Supabase" },
      body: {
        zh: "Project Settings → Supabase 选项里填 URL + anon key，Lovable 会自动生成 schema。",
        en: "In Project Settings → Supabase, paste URL + anon key. Lovable generates the schema for you."
      }
    },
    {
      title: { zh: "加自定义逻辑", en: "Add custom logic" },
      body: {
        zh: "需要复杂逻辑时，让 Lovable 输出代码后在 Editor 里手改，不要硬塞太复杂的 prompt。",
        en: "When you need complex logic, let Lovable output code and tweak it in the editor — don't push prompts past where they break."
      }
    },
    {
      title: { zh: "部署", en: "Deploy" },
      body: {
        zh: "一键发布到 Lovable hosting，绑定自有域名后即可让朋友测试。",
        en: "Hit publish to deploy on Lovable hosting and add your own domain so testers can hit it."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "Lovable 文档", en: "Lovable docs" }, url: "https://docs.lovable.dev" },
    { label: { zh: "Supabase 入门", en: "Supabase quickstart" }, url: "https://supabase.com/docs/guides/getting-started" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议在 Lovable 里只做“是否值得做”的验证；一旦验证通过、用户量起来就要接手代码并搬到自己的 CI/CD。",
    en: "AgentLens advice: use Lovable for the 'is this worth building?' check. Once usage takes off, take ownership of the code and move it into your own CI/CD."
  },
  commonPitfalls: [
    { zh: "复杂业务逻辑越写越乱，最后没人能维护。", en: "Letting business logic balloon inside Lovable until nobody can maintain it." },
    { zh: "把生产数据放在默认 Supabase project 而不做备份。", en: "Putting production data on the default Supabase project without backups." }
  ]
};
