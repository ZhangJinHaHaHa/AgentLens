/**
 * 品牌标识提供返回当前语言首页的稳定站内入口，并组合装饰图形与本地化产品名；它不读取品牌资产网络资源，也不控制导航栏布局。
 * 输入为可选样式，输出为一个 React Router 链接，路径经语言感知构建器生成。
 * 组件无状态、无 I/O，唯一可观察效果是用户激活链接后的客户端导航。
 * 翻译文本和当前 locale 来自应用上下文边界，本层只作为纯文本呈现，不能根据品牌点击触发登录、钱包或权限行为。
 * 可见产品名构成链接名称，外层图形和内层 SVG 都对辅助技术隐藏；窄宽度允许文字截断，但焦点目标和首页语义必须保持。
 */
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
        "group inline-flex min-w-0 items-center gap-2 text-sm font-medium tracking-tight text-foreground",
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
      <span className="truncate text-base font-medium">{t("appName")}</span>
    </Link>
  );
}
