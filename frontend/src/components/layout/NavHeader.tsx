import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/useLocale";
import { truncateAddress } from "@/lib/format";
import { useCompareSelection } from "@/hooks/useCompareSelection";

import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { key: "agents", to: "/agents" },
  { key: "compare", to: "/compare" },
  { key: "recommend", to: "/recommend" },
  { key: "publish", to: "/publish" }
] as const;

export function NavHeader(): JSX.Element {
  const { t } = useTranslation("common");
  const { buildPath } = useLocale();
  const wallet = useWallet();
  const { ids, compareHref } = useCompareSelection();

  return (
    <header className="glass-nav sticky top-0 z-40 w-full border-b">
      <div className="container-page flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.key}
                to={buildPath(item.key === "compare" ? compareHref : item.to)}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
                    isActive && "text-foreground"
                  )
                }
              >
                {t(`nav.${item.key}`)}
                {item.key === "compare" && ids.length > 0 ? ` (${ids.length})` : ""}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              if (wallet.status === "connected") {
                wallet.disconnect();
                return;
              }
              void wallet.connect();
            }}
            disabled={wallet.status === "connecting" || wallet.status === "unavailable"}
            title={wallet.errorMessage ?? undefined}
          >
            <Wallet className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">
              {wallet.status === "connected" && wallet.address
                ? truncateAddress(wallet.address)
                : wallet.status === "connecting"
                  ? t("wallet.connecting")
                  : t("wallet.label")}
            </span>
          </Button>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
