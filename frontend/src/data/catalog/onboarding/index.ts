import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * 本模块是指南的显式注册边界：各文件输出人工维护的双语静态指南，ALL_GUIDES 再向详情页提供
 * 按 agentId 查找和批量列举两种视图；它不会扫描目录，也不会从官网动态发现教程。
 * agentId 必须与 curated 条目的稳定 id 完全一致，否则详情页查找不到指南并回退到官方链接；
 * 重复 agentId 会被 Map 的后项静默覆盖，所以新增指南必须同时检查唯一性和 hasOnboardingGuide。
 * ALL_GUIDES 的声明顺序是 listOnboardingGuides 的兼容输出顺序，slice 只隔离数组成员增删，
 * 并不深拷贝指南对象。这里不得校验账号、安装环境或官方链接，也不得执行任何上手步骤；
 * 缺失项以 undefined 表示可预期的“无平台指南”，而模块导入失败才是阻断全部指南展示的故障。
 */
import { guide as aider } from "./aider";
import { guide as autogenStudio } from "./autogen-studio";
import { guide as boltNew } from "./bolt-new";
import { guide as browserUseReadonly } from "./browser-use-readonly";
import { guide as claudeCode } from "./claude-code";
import { guide as codex } from "./codex";
import { guide as continueDev } from "./continue-dev";
import { guide as coze } from "./coze";
import { guide as crewaiPlatform } from "./crewai-platform";
import { guide as cursor } from "./cursor";
import { guide as devin } from "./devin";
import { guide as dify } from "./dify";
import { guide as docsgpt } from "./docsgpt";
import { guide as githubCopilot } from "./github-copilot";
import { guide as gptResearcher } from "./gpt-researcher";
import { guide as googleGemini } from "./google-gemini";
import { guide as intercomFin } from "./intercom-fin";
import { guide as langgraphPlatform } from "./langgraph-platform";
import { guide as lovable } from "./lovable";
import { guide as manus } from "./manus";
import { guide as meetingDigest } from "./meeting-digest";
import { guide as microsoftCopilot } from "./microsoft-copilot";
import { guide as midjourney } from "./midjourney";
import { guide as n8nAi } from "./n8n-ai";
import { guide as openclaw } from "./openclaw";
import { guide as openaiGpt5 } from "./openai-gpt5";
import { guide as openhands } from "./openhands";
import { guide as perplexity } from "./perplexity";
import { guide as replitAgent } from "./replit-agent";
import { guide as v0 } from "./v0";
import { guide as zapierAgents } from "./zapier-agents";

const ALL_GUIDES: OnboardingGuide[] = [
  aider,
  autogenStudio,
  boltNew,
  browserUseReadonly,
  claudeCode,
  codex,
  continueDev,
  coze,
  crewaiPlatform,
  cursor,
  devin,
  dify,
  docsgpt,
  githubCopilot,
  gptResearcher,
  googleGemini,
  intercomFin,
  langgraphPlatform,
  lovable,
  manus,
  meetingDigest,
  microsoftCopilot,
  midjourney,
  n8nAi,
  openclaw,
  openaiGpt5,
  openhands,
  perplexity,
  replitAgent,
  v0,
  zapierAgents
];

export const onboardingGuides = new Map<string, OnboardingGuide>(
  ALL_GUIDES.map((guide) => [guide.agentId, guide])
);

export function getOnboardingGuide(agentId: string): OnboardingGuide | undefined {
  return onboardingGuides.get(agentId);
}

export function listOnboardingGuides(): OnboardingGuide[] {
  return ALL_GUIDES.slice();
}
