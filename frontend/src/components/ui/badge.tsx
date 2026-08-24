/**
 * Badge 是非交互状态/分类文字的视觉原语，通过受控 variant 统一颜色与边框；它不计算状态、不验证内容，也不能替代按钮、警告地标或权限判断。
 * 输入为标准 span 属性、样式和变体，输出为保留子内容与 ref 语义的行内元素，同时导出 variant 生成器供组合组件复用。
 * 组件无状态和副作用，class 合并仅在渲染时发生；事件属性虽可被透传，但不应借此把徽标伪装成缺少键盘语义的控件。
 * 子内容由调用方跨组件边界提供，React 负责普通文本转义；业务代码不得从渲染后的颜色或 `data` 外观推断可信状态。
 * 所有 variant 都必须有可见文字补充色彩含义，长内容允许收缩/换行由调用方控制；既有变体名称是全站样式兼容契约。
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "theme-badge inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-foreground text-background",
        secondary:
          "border-transparent bg-muted text-muted-foreground",
        outline: "border-border text-foreground",
        success:
          "border-transparent bg-success text-success-foreground",
        warning:
          "border-transparent bg-warning text-warning-foreground",
        danger:
          "border-transparent bg-danger text-danger-foreground",
        muted:
          "border-border bg-muted text-muted-foreground"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): JSX.Element {
  const resolvedVariant = variant ?? "default";
  return <span className={cn(badgeVariants({ variant: resolvedVariant }), className)} data-variant={resolvedVariant} {...props} />;
}

export { badgeVariants };
