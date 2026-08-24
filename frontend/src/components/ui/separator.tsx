/**
 * Separator 将水平/垂直分隔的尺寸和主题颜色封装在 Radix 语义之上；它不创建布局间距，也不代表业务状态边界。
 * 输入为 orientation、decorative、样式、原生属性及 ref，输出对应方向的一条分隔线，缺省为水平且纯装饰。
 * 组件无状态、事件副作用或浏览器 I/O，方向只影响确定的宽高类。
 * 属性由调用方跨边界提供，若分隔本身具有文档语义，必须显式关闭 decorative；样式层不能据此推断内容敏感级别或安全隔离。
 * 装饰分隔不得进入无意义的读屏顺序，语义分隔则需保持正确 orientation；默认值和 Radix ref 契约须兼容既有卡片布局。
 */
import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

export const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className
    )}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;
