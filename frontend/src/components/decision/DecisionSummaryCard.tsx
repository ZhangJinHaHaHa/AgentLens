/**
 * 决策摘要从目录条目截取最关键的适用、不适用、主要风险与下一步，形成快速浏览视图；它不重新评分代理，也不替用户作采购或安全决策。
 * 输入是完整目录条目，输出为四列本地化摘要；缺少风险注记时按风险级别回退，缺少场景时使用清晰空态。
 * 组件无状态、无 I/O，所有截取与文本选择均在渲染期间完成，不会修改传入数组或持久化选择。
 * 目录陈述和翻译内容属于展示数据边界，React 只保证文本转义，不保证推荐、风险或来源真实；下一步回退也不能被解释为外部操作已获授权。
 * 每列保留文字标题和列表语义，装饰图标隐藏；固定截取上限与空值回退是版面和旧数据兼容不变量，不能因字段过长而省略风险含义。
 */
import { ArrowRight, CircleSlash, Compass, ShieldAlert, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/i18n/useLocale";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";

interface DecisionSummaryCardProps {
  entry: AgentCatalogEntry;
}

export function DecisionSummaryCard({ entry }: DecisionSummaryCardProps): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("detail");

  const fitFor = entry.recommendedFor.slice(0, 3);
  const notFitFor = entry.unsuitableScenarios.slice(0, 2);
  const mainRisk = entry.riskNotes[0]
    ? pickText(entry.riskNotes[0], locale)
    : t(`summary.riskFallback.${entry.riskLevel}`);

  const nextStep = pickText(
    {
      zh: t("summary.nextStepFallback." + entry.source, { defaultValue: t("summary.nextStepFallback.curated") }),
      en: t("summary.nextStepFallback." + entry.source, { defaultValue: t("summary.nextStepFallback.curated") })
    },
    locale
  );

  return (
    <Card className="border-foreground/20 bg-foreground/[0.02]">
      <CardHeader>
        <CardTitle className="text-2xl">{t("summary.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-4">
        <SummaryColumn
          icon={<Sparkles className="h-4 w-4" aria-hidden />}
          label={t("summary.fitFor")}
        >
          {fitFor.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm text-foreground">
              {fitFor.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/60" aria-hidden />
                  <span>{pickText(item, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </SummaryColumn>

        <SummaryColumn
          icon={<CircleSlash className="h-4 w-4" aria-hidden />}
          label={t("summary.notFitFor")}
        >
          {notFitFor.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("scenarios.noUnfit")}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm text-foreground">
              {notFitFor.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                  <span>{pickText(item.label, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </SummaryColumn>

        <SummaryColumn
          icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
          label={t("summary.mainRisk")}
        >
          <p className="text-sm text-foreground">{mainRisk}</p>
        </SummaryColumn>

        <SummaryColumn
          icon={<Compass className="h-4 w-4" aria-hidden />}
          label={t("summary.nextStep")}
        >
          <p className="flex items-start gap-2 text-sm text-foreground">
            <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden />
            <span>{nextStep}</span>
          </p>
        </SummaryColumn>
      </CardContent>
    </Card>
  );
}

function SummaryColumn({
  icon,
  label,
  children
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}
