import type { TrustTier } from "@/domain/catalog";

export interface TierStyle {
  badgeClass: string;
  dotClass: string;
}

export function tierStyle(tier: TrustTier): TierStyle {
  switch (tier) {
    case 3:
      return {
        badgeClass:
          "border-success/40 bg-success/10 text-success-foreground/80 dark:bg-success/20 dark:text-success-foreground",
        dotClass: "bg-success"
      };
    case 2:
      return {
        badgeClass:
          "border-foreground/30 bg-foreground/5 text-foreground",
        dotClass: "bg-foreground"
      };
    case 1:
      return {
        badgeClass:
          "border-warning/40 bg-warning/10 text-warning-foreground/80 dark:bg-warning/20 dark:text-warning-foreground",
        dotClass: "bg-warning"
      };
    case 0:
    default:
      return {
        badgeClass:
          "border-border bg-muted text-muted-foreground",
        dotClass: "bg-muted-foreground/60"
      };
  }
}
