/**
 * 双语领域文本的最小适配层：从 `zh/en` 结构、普通字符串或缺省值中选择当前语言文本，并提供运行时形状守卫。
 * 所有函数均为纯计算，不访问 i18n 全局实例、浏览器存储或网络，也不存在缓存、失败重试和状态更新。
 * `isI18nText` 只确认对象及两个字段为字符串，不校验内容来源或安全性；外部目录文案仍须由 React 文本渲染或等价转义边界处理。
 * 缺失输入输出空串，语言字段按当前 locale、中文、英文顺序回退；这一宽容行为用于兼容旧数据，不能掩盖发布阶段缺少翻译的质量检查。
 */
import type { SupportedLocale } from "@/i18n/config";

export interface I18nText {
  zh: string;
  en: string;
}

export function pickText(text: I18nText | string | undefined, locale: SupportedLocale): string {
  if (text == null) {
    return "";
  }
  if (typeof text === "string") {
    return text;
  }
  return text[locale] ?? text.zh ?? text.en ?? "";
}

export function isI18nText(value: unknown): value is I18nText {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { zh: unknown }).zh === "string" &&
    typeof (value as { en: unknown }).en === "string"
  );
}
