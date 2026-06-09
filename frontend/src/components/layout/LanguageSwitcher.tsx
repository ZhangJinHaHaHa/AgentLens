import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SUPPORTED_LOCALES, useLocale } from "@/i18n/useLocale";

export function LanguageSwitcher(): JSX.Element {
  const { locale, switchLocale } = useLocale();
  const { t } = useTranslation("common");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-2.5 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
          aria-label={t("language.label")}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{locale === "zh" ? t("language.zh") : t("language.en")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        <ul className="flex flex-col">
          {SUPPORTED_LOCALES.map((value) => (
            <li key={value}>
              <button
                type="button"
                onClick={() => switchLocale(value)}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors",
                  "hover:bg-muted",
                  value === locale ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <span>{value === "zh" ? t("language.zh") : t("language.en")}</span>
                {value === locale ? <span aria-hidden>•</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
