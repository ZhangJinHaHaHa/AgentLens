/**
 * 信任层级徽标提供紧凑/默认标签和补充原因 Tooltip；它只呈现上游 `TrustTierResult`，不计算层级、不授权操作，也不声称安全保证。
 * 输入包含结果、尺寸语义、图标开关与样式，输出始终有可见层级文字，并在提示内容中展开描述和原因。
 * 组件无自有状态与 I/O，Tooltip 的开合、定位和 Portal 生命周期由共享原语管理。
 * tier、reason key 和证据结论来自领域/外部数据边界，本层仅消费类型化结果；样式颜色不能被其他代码当作可信状态或权限信号解析。
 * 即使 Tooltip 因触摸、键盘或浏览器能力不可用，徽标文字仍必须独立表达层级；原因使用列表、装饰点隐藏，compact 只缩短文案而不能改变含义。
 */
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
