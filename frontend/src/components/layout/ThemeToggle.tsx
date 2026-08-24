/**
 * 外观控制器提供独立的明暗切换和受支持艺术主题菜单；它不定义主题 token、不写 DOM，也不参与业务偏好或账户资料管理。
 * 输入为布局样式和是否显示文字，输出为两个操作入口；当前模式、主题值和变更函数全部来自 `ThemeProvider`。
 * 点击会更新全局主题状态并由 Provider 承担 DOM/localStorage 副作用，菜单开合与焦点管理则委托 Popover 组件。
 * 持久化主题值属于可篡改浏览器边界，但此处只遍历封闭的 `ART_THEMES` 集合；视觉色板不构成任何安全或内容状态。
 * 两个按钮均有本地化 `aria-label`，文字隐藏时仍可识别；当前主题必须同时以菜单选中样式和可见名称表达，新增主题时色板、翻译与 Provider 映射需保持一致。
 */
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
