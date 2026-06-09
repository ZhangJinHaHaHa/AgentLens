import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useLocale } from "@/i18n/useLocale";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps): JSX.Element {
  const { t } = useTranslation("common");
  const { buildPath } = useLocale();

  return (
    <Link
      to={buildPath("/")}
      className={cn(
        "group inline-flex items-center gap-2 text-sm font-medium tracking-tight text-foreground",
        className
      )}
    >
      <span
        aria-hidden
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-foreground text-background transition-colors group-hover:bg-foreground/90"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
          <path
            d="M8 1.5L1.5 5.25v5.5L8 14.5l6.5-3.75v-5.5L8 1.5zm0 1.7l5 2.9-5 2.9-5-2.9 5-2.9zm-5 4.4l4.5 2.6v5L3 12.6V7.6zm10 0v5l-4.5 2.6v-5L13 7.6z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="text-base font-medium">{t("appName")}</span>
    </Link>
  );
}
