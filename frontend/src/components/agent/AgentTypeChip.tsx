/**
 * 来源标签把目录来源枚举映射为一致的视觉和本地化文字；它用于说明数据出处，不承担身份认证、可信度计算或访问控制。
 * 调用方可直接传 `source` 或传完整 `entry`，显式来源优先，均缺失时输出兼容旧调用方的 listed 标签，并合并可选样式。
 * 组件是无状态纯展示，不访问网络、存储或钱包，也不会改变条目。
 * 来源值原则上应由目录解析层约束；本层只消费类型化枚举，颜色不能被解释为已经验证外部发布者或链上所有权。
 * 可见本地化文字是主要可访问信息而非仅靠色彩区分；四类来源的键和值映射必须保持穷尽，避免新增来源静默显示为错误语义。
 */
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { AgentCatalogEntry, AgentSource } from "@/domain/catalog";

interface AgentTypeChipProps {
  source?: AgentSource;
  entry?: AgentCatalogEntry;
  className?: string;
}

const STYLES: Record<AgentSource, string> = {
  marketplace:
    "border-border bg-muted text-foreground",
  curated:
    "border-border bg-background text-foreground",
  listed:
    "border-border bg-background text-muted-foreground",
  native:
    "border-success/40 bg-success/10 text-success-foreground/80 dark:bg-success/20 dark:text-success-foreground"
};

export function AgentTypeChip(props: AgentTypeChipProps): JSX.Element {
  const { t } = useTranslation("common");
  const source = props.source ?? props.entry?.source ?? "listed";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        STYLES[source],
        props.className
      )}
    >
      {t(`agentSource.${source}`)}
    </span>
  );
}
