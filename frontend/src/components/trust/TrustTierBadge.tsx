import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TrustTier } from "@/domain/catalog";
import {
  tierDescriptionKey,
  tierLabelKey,
  tierShortLabelKey,
  type TrustTierResult
} from "@/domain/trustTier";

import { tierStyle } from "./tierStyle";

interface TrustTierBadgeProps {
  result: TrustTierResult;
  variant?: "compact" | "default";
  showIcon?: boolean;
  className?: string;
}

export function TrustTierBadge({
  result,
  variant = "default",
  showIcon = false,
  className
}: TrustTierBadgeProps): JSX.Element {
  const { t } = useTranslation("tiers");
  const style = tierStyle(result.tier);

  const label = t(variant === "compact" ? tierShortLabelKey(result.tier) : tierLabelKey(result.tier));

  const tooltipBody = (
    <div className="flex flex-col gap-2 text-xs leading-snug">
      <p className="font-medium text-foreground">{t(tierLabelKey(result.tier))}</p>
      <p className="text-muted-foreground">{t(tierDescriptionKey(result.tier))}</p>
      {result.reasons.length > 0 ? (
        <ul className="flex flex-col gap-1 text-muted-foreground">
          {result.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-1.5">
              <span aria-hidden className={cn("mt-1 h-1 w-1 rounded-full", style.dotClass)} />
              <span>{t(`reasons.${reason}`)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide transition-colors",
            style.badgeClass,
            className
          )}
        >
          {showIcon ? <ShieldCheck className="h-3 w-3" aria-hidden /> : (
            <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", style.dotClass)} />
          )}
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltipBody}</TooltipContent>
    </Tooltip>
  );
}
