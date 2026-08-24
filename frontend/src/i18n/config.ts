/**
 * 国际化进程级初始化入口：注册 React 适配器和浏览器语言探测器，把中英文九个命名空间作为打包资源装入单例 i18n 实例。
 * 初始化具有模块副作用，但不发起翻译网络请求；探测顺序为路径、localStorage、navigator，并把选中语言缓存回浏览器存储。
 * 路径、存储和浏览器偏好均属客户端不可信输入，最终只允许 `SUPPORTED_LOCALES`，无法识别时稳定回退中文。
 * `escapeValue: false` 依赖 React 默认文本转义，翻译内容不得绕过 React 注入原始 HTML；资源 JSON 仍应在发布阶段审查。
 * `isInitialized` 守卫保证热更新/重复导入不重置现有状态；初始化 Promise 不在此重试，命名空间及默认语言是路由与翻译键的兼容契约。
 */
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
