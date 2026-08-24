/**
 * 风险说明卡并列呈现目录风险等级、具体风险注记和缓解建议；它解释已有评估，不执行安全扫描、权限判断或风险重新分级。
 * 输入为代理条目，输出为带本地化等级说明的两栏列表，缺少注记或缓解措施时分别提供显式空态与通用回退。
 * 该组件无状态、无网络或浏览器副作用，风险色调只是由类型化等级到样式的确定映射。
 * 风险内容来自目录信任边界，必须视作供决策参考的声明而非防护保证；低风险样式也绝不能绕过安装、钱包或运行时确认。
 * 等级和分区均有可见文字，不能只用红黄绿色传义；装饰图标隐藏、列表顺序稳定，并确保历史条目缺少缓解字段时仍可完整阅读。
 */
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLocale } from "@/i18n/useLocale";
import type { AgentCatalogEntry, RiskLevel } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";
import { cn } from "@/lib/utils";

interface RiskExplainCardProps {
  entry: AgentCatalogEntry;
}

const RISK_STYLES: Record<RiskLevel, string> = {
  low: "border-success/40 bg-success/10 text-success-foreground/80 dark:bg-success/20",
  medium: "border-warning/40 bg-warning/10 text-warning-foreground/80 dark:bg-warning/20",
  high: "border-danger/40 bg-danger/10 text-danger-foreground/80 dark:bg-danger/20"
};

export function RiskExplainCard({ entry }: RiskExplainCardProps): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("detail");
  const { t: tc } = useTranslation("common");
  const { t: tr } = useTranslation("risks");

  const riskNotes = entry.riskNotes;
  const mitigation = entry.riskMitigation ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{t("risk.title")}</CardTitle>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium uppercase tracking-wide",
              RISK_STYLES[entry.riskLevel]
            )}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {tc(`risk.${entry.riskLevel}`)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{tr(`explainers.${entry.riskLevel}`)}</p>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("risk.notes")}
          </p>
          {riskNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {riskNotes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span className="text-foreground">{pickText(note, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-3 md:border-l md:border-border md:pl-6">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {t("risk.mitigation")}
          </p>
          {mitigation.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("risk.mitigationFallback")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {mitigation.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/60" />
                  <span className="text-foreground">{pickText(note, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
      <Separator className="opacity-0" />
    </Card>
  );
}
