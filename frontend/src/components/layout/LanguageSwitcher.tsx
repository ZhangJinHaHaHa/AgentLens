/**
 * 语言切换器在当前中文/英文路由之间执行一次显式切换，并可按布局需要显示当前语言文字；它不加载翻译资源，也不自行解析任意 locale。
 * 输入仅为附加样式和标签可见性，输出为按钮；下一语言由当前受支持语言确定，点击后委托 `useLocale` 保留对应导航语义。
 * 无本地状态，副作用是上下文触发的语言与地址更新；组件不会写存储或直接调用 History API。
 * 当前路径和语言状态来自浏览器/路由边界，切换目标被封闭在 zh/en 集合中，不能将 URL 中的任意段落回显为语言值。
 * 按钮的可访问名称明确说出目标语言，地球图标隐藏；标签在视觉隐藏时仍不能丢失名称，二元切换与既有深链保持是兼容不变量。
 */
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/useLocale";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  showLabel?: boolean;
}

export function LanguageSwitcher({ className, showLabel = false }: LanguageSwitcherProps): JSX.Element {
  const { locale, switchLocale } = useLocale();
  const { t } = useTranslation("common");
  const nextLocale = locale === "zh" ? "en" : "zh";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("h-9 gap-1.5 px-2.5 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground", className)}
      aria-label={t("language.toggle", {
        target: nextLocale === "zh" ? t("language.zh") : t("language.en")
      })}
      onClick={() => switchLocale(nextLocale)}
    >
      <Globe className="h-4 w-4" aria-hidden />
      <span className={showLabel ? "inline" : "hidden sm:inline"}>
        {locale === "zh" ? t("language.zh") : t("language.en")}
      </span>
    </Button>
  );
}
