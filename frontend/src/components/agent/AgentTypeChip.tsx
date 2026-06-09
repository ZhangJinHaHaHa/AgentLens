import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { AgentSource } from "@/domain/catalog";

interface AgentTypeChipProps {
  source: AgentSource;
  className?: string;
}

const STYLES: Record<AgentSource, string> = {
  marketplace:
    "border-primary/40 bg-primary/10 text-primary dark:bg-primary/20",
  curated:
    "border-foreground/30 bg-foreground/5 text-foreground",
  listed:
    "border-border bg-muted text-muted-foreground",
  native:
    "border-success/40 bg-success/10 text-success-foreground/80 dark:bg-success/20 dark:text-success-foreground"
};

export function AgentTypeChip({ source, className }: AgentTypeChipProps): JSX.Element {
  const { t } = useTranslation("common");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        STYLES[source],
        className
      )}
    >
      {t(`agentSource.${source}`)}
    </span>
  );
}
