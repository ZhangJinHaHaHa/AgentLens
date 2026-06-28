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
