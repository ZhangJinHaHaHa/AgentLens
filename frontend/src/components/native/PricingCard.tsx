import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/i18n/useLocale";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { pickText } from "@/domain/i18nText";

interface PricingCardProps {
  entry: AgentCatalogEntry;
}

export function PricingCard({ entry }: PricingCardProps): JSX.Element {
  const { locale } = useLocale();
  const { t } = useTranslation("detail");
  const label = entry.nativePricing?.label
    ? pickText(entry.nativePricing.label, locale)
    : entry.pricingHint
      ? pickText(entry.pricingHint, locale)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("native.pricing")}</CardTitle>
      </CardHeader>
      <CardContent>
        {label ? (
          <p className="text-sm text-foreground">{label}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("native.noPricing")}</p>
        )}
      </CardContent>
    </Card>
  );
}
