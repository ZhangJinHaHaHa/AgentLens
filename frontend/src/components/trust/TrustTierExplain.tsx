import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  tierDescriptionKey,
  tierLabelKey,
  type TrustTierResult
} from "@/domain/trustTier";

import { tierStyle } from "./tierStyle";

interface TrustTierExplainProps {
  result: TrustTierResult;
  className?: string;
}

export function TrustTierExplain({ result, className }: TrustTierExplainProps): JSX.Element {
  const { t } = useTranslation("tiers");
  const style = tierStyle(result.tier);

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span aria-hidden className={cn("inline-block h-2 w-2 rounded-full", style.dotClass)} />
          <CardTitle>{t(tierLabelKey(result.tier))}</CardTitle>
        </div>
        <CardDescription>{t(tierDescriptionKey(result.tier))}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2 text-sm">
          {result.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2">
              <span aria-hidden className={cn("mt-2 h-1 w-1 rounded-full", style.dotClass)} />
              <span className="text-foreground">{t(`reasons.${reason}`)}</span>
            </li>
          ))}
        </ul>
        {result.evidence.length > 0 ? (
          <>
            <Separator />
            <dl className="grid grid-cols-1 gap-3 text-sm">
              {result.evidence.map((item) => (
                <div key={item.key} className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {item.labelKey ? t(item.labelKey, { defaultValue: item.key }) : item.key}
                  </dt>
                  <dd className="break-all font-mono text-xs text-foreground/80">{item.value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
