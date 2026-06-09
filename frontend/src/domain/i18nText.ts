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
