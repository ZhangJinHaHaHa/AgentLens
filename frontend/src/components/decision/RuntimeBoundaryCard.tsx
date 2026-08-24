/**
 * 运行边界卡把使用方式、数据边界、运行安全、协议、交付物、禁用场景与差异化集中展示；它不启动代理、不建立网络连接，也不强制执行所描述的边界。
 * 输入为目录条目，输出为依据领域派生器生成的本地化说明网格，保持所有决策维度在同一阅读层级。
 * 组件没有可变状态和副作用，摘要、安全与协议对象只在渲染时读取，不修改目录源数据。
 * 发布者与目录提供的边界描述是不可信声明，读者仍需以实际沙箱、权限和协议握手为准；卡片本身不得被安全控制或合规证明复用。
 * 每项同时提供文字标签和值，图标仅作装饰；长值必须换行，未知/旧目录数据应由领域回退处理，网格重排不能改变信息顺序与语义。
 */
import { Box, CircleSlash, FileCheck2, Fingerprint, Route, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRuntimeProtocol, getRuntimeSecurity, type AgentCatalogEntry } from "@/domain/catalog";
import { buildAgentBuyerCardSummary } from "@/domain/agentBuyerCard";
import { pickText } from "@/domain/i18nText";
import { useLocale } from "@/i18n/useLocale";

interface RuntimeBoundaryCardProps {
  entry: AgentCatalogEntry;
}

export function RuntimeBoundaryCard({ entry }: RuntimeBoundaryCardProps): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("detail");
  const summary = buildAgentBuyerCardSummary(entry);
  const runtimeSecurity = getRuntimeSecurity(entry);
  const runtimeProtocol = getRuntimeProtocol(entry);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("runtimeBoundary.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("runtimeBoundary.description")}</p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <BoundaryItem
          icon={<Route className="h-4 w-4" aria-hidden />}
          label={t("runtimeBoundary.runMode")}
          value={pickText(summary.runMode, locale)}
        />
        <BoundaryItem
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          label={t("runtimeBoundary.dataBoundary")}
          value={pickText(summary.dataBoundary, locale)}
        />
        <BoundaryItem
          icon={<Box className="h-4 w-4" aria-hidden />}
          label={t("runtimeBoundary.runtimeSecurity")}
          value={`${pickText(runtimeSecurity.label, locale)}：${pickText(runtimeSecurity.description, locale)}`}
        />
        <BoundaryItem
          icon={<Fingerprint className="h-4 w-4" aria-hidden />}
          label={t("runtimeBoundary.runtimeProtocol")}
          value={`${pickText(runtimeProtocol.label, locale)}：${pickText(runtimeProtocol.description, locale)}`}
        />
        <BoundaryItem
          icon={<FileCheck2 className="h-4 w-4" aria-hidden />}
          label={t("runtimeBoundary.deliverable")}
          value={pickText(summary.deliverable, locale)}
        />
        <BoundaryItem
          icon={<CircleSlash className="h-4 w-4" aria-hidden />}
          label={t("runtimeBoundary.notFor")}
          value={pickText(summary.notFor, locale)}
        />
        <BoundaryItem
          icon={<Sparkles className="h-4 w-4" aria-hidden />}
          label={t("runtimeBoundary.differentiation")}
          value={pickText(summary.differentiation, locale)}
        />
      </CardContent>
    </Card>
  );
}

function BoundaryItem({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="break-words text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}
