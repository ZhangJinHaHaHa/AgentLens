/**
 * 目录卡片把一个 `AgentCatalogEntry` 汇总成可浏览的购买者视图，并提供加入/移出对比集的单一操作；它不加载目录、不验证审计证据，也不决定最终推荐结论。
 * 输入包括目录条目和可选样式，输出是含详情链接、任务分类、运行方式、信任层级与对比按钮的独立 `article`。
 * 派生摘要均为纯计算；唯一状态来源是共享对比选择，点击按钮会调用其增删操作，并严格沿用最多四项的上游容量约束。
 * 条目文本和标识可能来自外部目录，渲染依赖 React 转义且只通过语言化路径进入站内导航；展示的信任徽标是说明信息，绝不能被当作授权结果。
 * 详情链接与对比按钮必须保持两个可区分的键盘操作目标，按钮以 `aria-pressed` 暴露选择状态，装饰图标不进入可访问名称，空字段则按既有回退规则稳定隐藏。
 */
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/useLocale";
import { pickText } from "@/domain/i18nText";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { getAgentProductType, getRuntimeProtocol, isNativeEntry } from "@/domain/catalog";
import { buildAgentBuyerCardSummary } from "@/domain/agentBuyerCard";
import { getAgentTaskCategory, type AgentTaskCategory } from "@/domain/agentTaskCategory";
import { computeTrustTier } from "@/domain/trustTier";
import { useCompareSelection } from "@/hooks/useCompareSelection";

import { TrustTierBadge } from "@/components/trust/TrustTierBadge";

import { AgentTypeChip } from "./AgentTypeChip";

interface AgentCardProps {
  entry: AgentCatalogEntry;
  className?: string;
}

export function AgentCard({
  entry,
  className
}: AgentCardProps): JSX.Element {
  const { locale, buildPath } = useLocale();
  const { t } = useTranslation("agents");
  const { ids, addId, removeId } = useCompareSelection();
  const tier = computeTrustTier({ entry });
  const isCompared = ids.includes(entry.id);
  const productType = getAgentProductType(entry);
  const taskCategory = getAgentTaskCategory(entry);
  const buyerSummary = buildAgentBuyerCardSummary(entry);
  const runtimeProtocol = getRuntimeProtocol(entry);
  const showSourceChip = isNativeEntry(entry);

  function handleCompare(): void {
    if (isCompared) {
      removeId(entry.id);
      return;
    }
    addId(entry.id);
  }

  return (
    <article
      className={cn(
        "group flex h-full min-h-[19.5rem] min-w-0 flex-col gap-4 border-l-2 border-l-transparent p-5 surface-card-interactive hover:border-l-foreground/70 sm:min-h-[21rem] sm:p-6",
        className
      )}
    >
      <Link to={buildPath(`/agent/${entry.id}`)} className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <TaskCategoryChip category={taskCategory} />
            {showSourceChip ? <AgentTypeChip source={entry.source} /> : null}
          </div>
          <TrustTierBadge result={tier} variant="compact" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 break-words text-lg font-medium tracking-tight text-foreground sm:text-xl">
              {entry.name}
            </h3>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
              aria-hidden
            />
          </div>
          <p className="line-clamp-2 min-w-0 break-words text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{t("card.currentState")}: </span>
            {pickText(runtimeProtocol.label, locale)}
          </p>
          {entry.tagline ?? buyerSummary.outcome ? (
            <p className="line-clamp-1 break-words text-sm font-medium text-foreground/90">
              {pickText(entry.tagline ?? buyerSummary.outcome, locale)}
            </p>
          ) : null}
          <p className="line-clamp-3 break-words text-sm text-muted-foreground">{pickText(entry.intro, locale)}</p>
        </div>

      </Link>

      <Button
        type="button"
        size="sm"
        variant={isCompared ? "outline" : "secondary"}
        aria-pressed={isCompared}
        disabled={!isCompared && ids.length >= 4}
        onClick={handleCompare}
        className="relative z-10 w-full justify-center"
      >
        {isCompared ? (
          <Check className="h-3.5 w-3.5 text-success" aria-hidden />
        ) : (
          <Plus className="h-3.5 w-3.5" aria-hidden />
        )}
        {isCompared ? t("card.addedToCompare") : t("card.addToCompare")}
      </Button>
    </article>
  );
}

const TASK_CATEGORY_CHIP_CLASS: Record<AgentTaskCategory, string> = {
  code_debug: "border-rose-500/45 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  research: "border-sky-500/45 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  document: "border-teal-500/45 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  automation: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  other: "border-violet-500/45 bg-violet-500/10 text-violet-700 dark:text-violet-300"
};

function TaskCategoryChip({ category }: { category: AgentTaskCategory }): JSX.Element {
  const { t } = useTranslation("common");
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        TASK_CATEGORY_CHIP_CLASS[category]
      )}
    >
      <span className="truncate">{t(`agentTaskCategory.${category}`)}</span>
    </span>
  );
}
