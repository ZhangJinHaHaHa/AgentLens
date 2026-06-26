import type { OnboardingGuide } from "@/domain/onboarding";

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
