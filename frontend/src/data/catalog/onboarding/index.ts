import type { OnboardingGuide } from "@/domain/onboarding";

import { guide as aider } from "./aider";
import { guide as boltNew } from "./bolt-new";
import { guide as claudeCode } from "./claude-code";
import { guide as continueDev } from "./continue-dev";
import { guide as cursor } from "./cursor";
import { guide as devin } from "./devin";
import { guide as lovable } from "./lovable";
import { guide as openaiGpt5 } from "./openai-gpt5";
import { guide as openhands } from "./openhands";
import { guide as replitAgent } from "./replit-agent";
import { guide as v0 } from "./v0";

const ALL_GUIDES: OnboardingGuide[] = [
  aider,
  boltNew,
  claudeCode,
  continueDev,
  cursor,
  devin,
  lovable,
  openaiGpt5,
  openhands,
  replitAgent,
  v0
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
