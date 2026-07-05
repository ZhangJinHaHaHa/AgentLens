import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import zhCommon from "./locales/zh/common.json";
import zhHome from "./locales/zh/home.json";
import zhAgents from "./locales/zh/agents.json";
import zhDetail from "./locales/zh/detail.json";
import zhCompare from "./locales/zh/compare.json";
import zhReport from "./locales/zh/report.json";
import zhTiers from "./locales/zh/tiers.json";
import zhRisks from "./locales/zh/risks.json";
import zhScenarios from "./locales/zh/scenarios.json";

import enCommon from "./locales/en/common.json";
import enHome from "./locales/en/home.json";
import enAgents from "./locales/en/agents.json";
import enDetail from "./locales/en/detail.json";
import enCompare from "./locales/en/compare.json";
import enReport from "./locales/en/report.json";
import enTiers from "./locales/en/tiers.json";
import enRisks from "./locales/en/risks.json";
import enScenarios from "./locales/en/scenarios.json";

export const SUPPORTED_LOCALES = ["zh", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "zh";

const NAMESPACES = [
  "common",
  "home",
  "agents",
  "detail",
  "compare",
  "report",
  "tiers",
  "risks",
  "scenarios"
] as const;

export type Namespace = (typeof NAMESPACES)[number];

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        zh: {
          common: zhCommon,
          home: zhHome,
          agents: zhAgents,
          detail: zhDetail,
          compare: zhCompare,
          report: zhReport,
          tiers: zhTiers,
          risks: zhRisks,
          scenarios: zhScenarios
        },
        en: {
          common: enCommon,
          home: enHome,
          agents: enAgents,
          detail: enDetail,
          compare: enCompare,
          report: enReport,
          tiers: enTiers,
          risks: enRisks,
          scenarios: enScenarios
        }
      },
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: [...SUPPORTED_LOCALES],
      ns: [...NAMESPACES],
      defaultNS: "common",
      interpolation: {
        escapeValue: false
      },
      detection: {
        order: ["path", "localStorage", "navigator"],
        lookupFromPathIndex: 0,
        caches: ["localStorage"]
      },
      returnNull: false
    });
}

export default i18n;

export function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return value !== undefined && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
