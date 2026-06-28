import { Moon, Sun, Palette } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ART_THEMES, type ArtTheme, useTheme } from "@/app/theme";
import { cn } from "@/lib/utils";

const ART_THEME_SWATCHES: Record<ArtTheme, string> = {
  swiss: "bg-[linear-gradient(135deg,#ffffff_0%,#ffffff_48%,#000000_48%,#000000_54%,#6366f1_54%,#6366f1_100%)]",
  atelier: "bg-[linear-gradient(135deg,#faf9f3_0%,#d9a84e_45%,#4f623a_100%)]",
  nocturne: "bg-[linear-gradient(135deg,#0a141e_0%,#0d2c54_45%,#ebc246_100%)]",
  pixel: "bg-[linear-gradient(135deg,#131313_0%,#39ff14_52%,#ffdb58_100%)]",
  crimson: "bg-[linear-gradient(135deg,#fbf9f4_0%,#e1bebb_48%,#7e000e_100%)]"
};

interface ThemeToggleProps {
  className?: string;
  showLabels?: boolean;
}

export function ThemeToggle({ className, showLabels = false }: ThemeToggleProps): JSX.Element {
  const { theme, artTheme, toggleTheme, setArtTheme } = useTheme();
  const { t } = useTranslation("common");

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Light/Dark Toggle */}
      <Button
        variant="ghost"
        size={showLabels ? "sm" : "icon"}
        className={cn("h-9 text-muted-foreground hover:text-foreground", showLabels ? "w-full px-3" : "w-9")}
        aria-label={t("theme.label")}
        onClick={toggleTheme}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {showLabels ? <span className="text-xs">{t("theme.label")}</span> : null}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size={showLabels ? "sm" : "icon"}
            className={cn("h-9 text-muted-foreground hover:text-foreground", showLabels ? "w-full px-3" : "w-9")}
            aria-label={t("theme.artLabel")}
          >
            <Palette className="h-4 w-4" />
            {showLabels ? <span className="text-xs">{t("theme.artLabel")}</span> : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("theme.artLabel")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ART_THEMES.map((themeId) => (
            <DropdownMenuItem
              key={themeId}
              onClick={() => setArtTheme(themeId)}
              className={cn("gap-2", artTheme === themeId && "bg-accent/50")}
            >
              <span
                className={cn(
                  "h-3.5 w-3.5 rounded-[2px] border border-white/70 shadow-sm",
                  ART_THEME_SWATCHES[themeId]
                )}
              />
              {t(`theme.art.${themeId}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
