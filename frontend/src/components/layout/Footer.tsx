import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useLocale } from "@/i18n/useLocale";
import { useCompareSelection } from "@/hooks/useCompareSelection";

const FOOTER_LINKS = [
  { key: "agents", to: "/agents" },
  { key: "compare", to: "/compare" },
  { key: "recommend", to: "/recommend" }
] as const;

export function Footer(): JSX.Element {
  const { t } = useTranslation("common");
  const { buildPath } = useLocale();
  const { ids, compareHref } = useCompareSelection();
  const year = new Date().getFullYear();

  return (
    <footer className="glass-nav relative z-10 mt-24 border-t">
      <div className="container-page flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">{t("appName")}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t("footer.tagline")}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.key} to={buildPath(link.key === "compare" ? compareHref : link.to)} className="hover:text-foreground">
              {t(`nav.${link.key}`)}
              {link.key === "compare" && ids.length > 0 ? ` (${ids.length})` : ""}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-border/70">
        <div className="container-page py-4 text-xs text-muted-foreground">
          {t("footer.rights", { year })}
        </div>
      </div>
    </footer>
  );
}
