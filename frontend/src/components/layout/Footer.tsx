/**
 * 页脚提供全站次级导航、品牌说明、动态年份及对比数量入口；它不加载目录、不修改选择，也不承担主导航的当前页状态。
 * 无显式属性输入，语言、路径构建器和共享对比集来自上下文，输出为一个语义化 footer 与内部 nav。
 * 组件无本地状态和外部 I/O，时间只在渲染时读取；点击链接的历史变更由路由器处理。
 * 对比标识和目录路由都属于客户端状态/地址边界，必须通过 `buildPath` 保持当前语言，且不能把数量展示当作服务器确认。
 * 链接文字始终可见并按固定产品顺序排列，窄屏仅换行不重排；空对比集不得附加计数，年份变化也不能影响 hydration 之外的业务契约。
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useLocale } from "@/i18n/useLocale";
import { useCompareSelection } from "@/hooks/useCompareSelection";

const FOOTER_LINKS = [
  { key: "agents", to: "/agents" },
  { key: "compare", to: "/compare" },
  { key: "recommend", to: "/recommend" },
  { key: "models", to: "/models" },
  { key: "account", to: "/account" }
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
