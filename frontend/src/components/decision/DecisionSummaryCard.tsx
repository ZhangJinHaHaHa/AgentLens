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
