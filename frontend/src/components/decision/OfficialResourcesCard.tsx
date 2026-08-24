/**
 * 官方资源卡只汇集条目声明的主页、文档和定价地址，并在有值时提供离站入口；它不抓取页面、不校验域名所有权，也不缓存远端内容。
 * 输入是目录条目，输出为可用链接集合及可选定价提示；三类地址都缺失时以明确占位符保留卡片结构。
 * 本组件不持有状态，唯一副作用发生在用户主动点击后由浏览器打开新标签页。
 * `officialUrl`、`docsUrl`、`pricingUrl` 是发布者可控的外部导航边界，链接文字不能构成真实性背书，`target=_blank` 必须与 `rel=noreferrer` 一起保留以隔离 opener/referrer。
 * 每个链接具有可见用途名称且装饰图标不污染读屏；过滤空地址、保持长提示换行以及不自动跳转是失败与兼容不变量。
 */
import { ArrowUpRight, BookOpen, ExternalLink, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/i18n/useLocale";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";
import { cn } from "@/lib/utils";

interface OfficialResourcesCardProps {
  entry: AgentCatalogEntry;
}

export function OfficialResourcesCard({ entry }: OfficialResourcesCardProps): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("detail");

  const resources: Array<{ key: string; label: string; href?: string; icon: JSX.Element }> = [
    {
      key: "homepage",
      label: t("official.homepage"),
      href: entry.officialUrl,
      icon: <ExternalLink className="h-4 w-4" aria-hidden />
    },
    {
      key: "docs",
      label: t("official.docs"),
      href: entry.docsUrl,
      icon: <BookOpen className="h-4 w-4" aria-hidden />
    },
    {
      key: "pricing",
      label: t("official.pricing"),
      href: entry.pricingUrl,
      icon: <Tag className="h-4 w-4" aria-hidden />
    }
  ];

  const visible = resources.filter((item) => item.href);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("official.title")}</CardTitle>
        {entry.pricingHint ? (
          <p className="text-sm text-muted-foreground">{pickText(entry.pricingHint, locale)}</p>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          visible.map((item) => (
            <a
              key={item.key}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "group glass-input flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm",
                "hover:border-foreground/40"
              )}
            >
              <span className="flex items-center gap-2 text-foreground">
                <span className="text-muted-foreground">{item.icon}</span>
                {item.label}
              </span>
              <ArrowUpRight
                className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground"
                aria-hidden
              />
            </a>
          ))
        )}
      </CardContent>
    </Card>
  );
}
