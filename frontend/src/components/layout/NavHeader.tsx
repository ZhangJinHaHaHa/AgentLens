import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
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
  { key: "models", to: "/models" },
  { key: "recommend", to: "/recommend" },
  { key: "compare", to: "/compare" },
  { key: "publish", to: "/publish" },
  { key: "account", to: "/account" }
] as const;

export function NavHeader(): JSX.Element {
  const { t } = useTranslation("common");
  const { buildPath } = useLocale();
  const wallet = useWallet();
  const { ids, compareHref } = useCompareSelection();
  const handleWalletClick = () => {
    if (wallet.status === "connected") {
      wallet.disconnect();
      return;
    }
    void wallet.connect();
  };
  const walletLabel = wallet.status === "connected" && wallet.address
    ? truncateAddress(wallet.address)
    : wallet.status === "connecting"
      ? t("wallet.connecting")
      : t("wallet.label");

  return (
    <header className="al-site-header sticky top-0 z-40 w-full border-b">
      <div className="container-page flex h-14 min-w-0 items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-8">
          <Logo className="al-site-brand" />
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.key}
                item={item}
                to={buildPath(item.key === "compare" ? compareHref : item.to)}
                label={t(`nav.${item.key}`)}
                count={item.key === "compare" ? ids.length : 0}
              />
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="al-site-menu-trigger md:hidden"
                aria-label={t("nav.menu")}
              >
                <Menu className="h-4 w-4" aria-hidden />
              </Button>
            </DialogTrigger>
            <DialogContent className="al-site-mobile-menu left-4 right-4 top-16 w-auto max-w-none translate-x-0 translate-y-0 gap-2 p-4 md:hidden">
              <DialogTitle className="sr-only">{t("nav.menu")}</DialogTitle>
              <DialogDescription className="sr-only">{t("nav.menu")}</DialogDescription>
              <div className="al-site-mobile-menu-heading">{t("nav.menu")}</div>
              <nav className="flex flex-col gap-1 text-sm">
                {NAV_ITEMS.map((item) => (
                  <DialogClose key={item.key} asChild>
                    <NavItem
                      item={item}
                      to={buildPath(item.key === "compare" ? compareHref : item.to)}
                      label={t(`nav.${item.key}`)}
                      count={item.key === "compare" ? ids.length : 0}
                      mobile
                    />
                  </DialogClose>
                ))}
              </nav>
              <div className="al-site-mobile-actions" aria-label={t("nav.menu")}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="al-site-wallet-button w-full justify-center"
                  onClick={handleWalletClick}
                  disabled={wallet.status === "connecting" || wallet.status === "unavailable"}
                  title={wallet.errorMessage ?? undefined}
                >
                  <Wallet className="h-4 w-4" aria-hidden />
                  <span>{walletLabel}</span>
                </Button>
                <div className="al-site-mobile-action-row">
                  <LanguageSwitcher className="w-full justify-center" showLabel />
                  <ThemeToggle className="al-site-mobile-theme" showLabels />
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="al-site-wallet-button hidden md:inline-flex"
            onClick={handleWalletClick}
            disabled={wallet.status === "connecting" || wallet.status === "unavailable"}
            title={wallet.errorMessage ?? undefined}
          >
            <Wallet className="h-4 w-4" aria-hidden />
            <span>{walletLabel}</span>
          </Button>
          <div className="hidden items-center gap-1 md:flex">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

type NavItemDefinition = (typeof NAV_ITEMS)[number];

interface NavItemProps {
  item: NavItemDefinition;
  to: string;
  label: string;
  count: number;
  mobile?: boolean;
}

function NavItem({ item, to, label, count, mobile = false }: NavItemProps): JSX.Element {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "al-site-nav-link rounded-md transition-colors",
          mobile ? "px-3 py-3" : "px-3 py-1.5",
          isActive && "al-site-nav-link-active"
        )
      }
    >
      {label}
      {item.key === "compare" && count > 0 ? ` (${count})` : ""}
    </NavLink>
  );
}
