import type { OnboardingGuide } from "@/domain/onboarding";

export const guide: OnboardingGuide = {
  agentId: "openhands",
  prerequisites: [
    { zh: "本地或 staging 上有 Docker，并能访问 GPU（可选，但加速推理）。", en: "Docker on a local or staging machine, ideally with GPU access for inference." },
    { zh: "至少一个 LLM provider key（OpenAI / Anthropic / 本地 vLLM）。", en: "At least one LLM provider key (OpenAI / Anthropic / local vLLM)." },
    { zh: "明白 OpenHands 是“自治 Agent”，给的任务必须可以自动验证。", en: "Treat OpenHands as an autonomous agent — only delegate tasks that can be auto-verified." }
  ],
  firstStep: {
    zh: "用 docker run 一行起服务，然后在浏览器里跑 “修一个 README typo” 之类的小任务做冒烟。",
    en: "`docker run` the published image, then drive a tiny task like 'fix a README typo' from the browser to smoke-test."
  },
  steps: [
    {
      title: { zh: "拉镜像 & 起服务", en: "Pull image & boot" },
      body: {
        zh: "默认镜像在 ghcr.io/all-hands-ai/openhands。绑定 ./workspace 目录给 Agent 读写。",
        en: "Default image lives at ghcr.io/all-hands-ai/openhands. Mount a `./workspace` for the Agent to read/write."
      },
      codeBlock:
        "docker run -it --rm \\\n  -v ./workspace:/workspace \\\n  -e LLM_API_KEY=... \\\n  -p 3000:3000 ghcr.io/all-hands-ai/openhands:0.20"
    },
    {
      title: { zh: "选模型 & 工具", en: "Pick model & tools" },
      body: {
        zh: "在 Settings 里挑模型（推荐 GPT-5 / Claude 4 / 本地 vLLM），并显式开关 shell / browser / file edit 工具。",
        en: "In Settings, pick a model (GPT-5 / Claude 4 / local vLLM) and explicitly toggle shell / browser / file edit tools."
      }
    },
    {
      title: { zh: "明确停止条件", en: "Define stop conditions" },
      body: {
        zh: "对每个任务都设置 max_iterations 与超时，避免 Agent 无限循环烧 token。",
        en: "Per task, set max_iterations + timeout so the Agent can't loop forever burning tokens."
      }
    },
    {
      title: { zh: "评估与回归", en: "Evaluate & regression" },
      body: {
        zh: "用 OpenHands 自带的 evaluation/ 目录跑 SWE-Bench 子集，建立你团队的 baseline。",
        en: "Use the built-in evaluation/ folder to run a SWE-Bench subset and capture a baseline for your team."
      }
    }
  ],
  officialDocs: [
    { label: { zh: "OpenHands 文档", en: "OpenHands docs" }, url: "https://docs.all-hands.dev" },
    { label: { zh: "GitHub 仓库", en: "GitHub repo" }, url: "https://github.com/All-Hands-AI/OpenHands" }
  ],
  platformAdvice: {
    zh: "AgentLens 建议先在隔离的 staging 集群上跑，限制 outbound network；积累至少 50 次任务的成功率统计，再决定是否进生产。",
    en: "AgentLens advice: run inside an isolated staging cluster with outbound networking restricted. Collect success-rate metrics across 50+ tasks before considering production."
  },
  commonPitfalls: [
    { zh: "默认沙盒仍可访问主机网络，敏感环境要再加一层网络策略。", en: "The default sandbox still reaches the host network — wrap it in a stricter network policy for sensitive envs." },
    { zh: "把 Agent 当“免费 Devin”长跑，token / GPU 成本会失控。", en: "Treating it as a 'free Devin' that runs forever — token / GPU cost will blow up." }
  ]
};
