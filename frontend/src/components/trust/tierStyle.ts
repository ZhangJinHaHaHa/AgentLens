/**
 * 此映射是信任层级的唯一视觉 token 适配层，向徽标和说明组件返回边框/文字与指示点样式；它不包含层级计算、翻译或安全策略。
 * 输入为领域 `TrustTier`，输出两个稳定 class 字符串，不修改参数，也不接触 React、DOM 或浏览器状态。
 * 函数完全确定且无副作用，调用方可在任意渲染环境复用；未知运行时值按最低信息层级降级而不是误示为高可信。
 * tier 值应由领域层验证，CSS 类只服务展示，任何权限或交易路径都不得读取颜色来作决策。
 * 每一级必须同时由消费者提供可见文字，不能只靠绿/黄/灰点区分；default 回退及现有 token 名称是旧目录和主题兼容不变量。
 */
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
