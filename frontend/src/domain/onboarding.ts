import type { I18nText } from "./i18nText";

export interface OnboardingStep {
  title: I18nText;
  body: I18nText;
  /** Optional inline code block; left raw, no syntax highlighting yet. */
  codeBlock?: string;
}

export interface OnboardingDocLink {
  label: I18nText;
  url: string;
}

export interface OnboardingGuide {
  agentId: string;
  prerequisites: I18nText[];
  firstStep: I18nText;
  steps: OnboardingStep[];
  officialDocs: OnboardingDocLink[];
  /** Platform-specific advice that goes beyond the official quickstart. */
  platformAdvice: I18nText;
  commonPitfalls: I18nText[];
}
