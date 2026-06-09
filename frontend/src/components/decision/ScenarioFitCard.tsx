import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLocale } from "@/i18n/useLocale";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";

interface ScenarioFitCardProps {
  entry: AgentCatalogEntry;
}

export function ScenarioFitCard({ entry }: ScenarioFitCardProps): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("detail");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("scenarios.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("scenarios.fit")}
          </p>
          {entry.scenarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entry.scenarios.map((scenario) => (
                <span
                  key={scenario.id}
                  className="rounded-md border border-border bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {pickText(scenario.label, locale)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 md:border-l md:border-border md:pl-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("scenarios.unfit")}
          </p>
          {entry.unsuitableScenarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("scenarios.noUnfit")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entry.unsuitableScenarios.map((scenario) => (
                <span
                  key={scenario.id}
                  className="rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {pickText(scenario.label, locale)}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <Separator className="opacity-0" />
    </Card>
  );
}
