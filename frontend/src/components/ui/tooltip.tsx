/**
 * Tooltip 原语封装 Radix Provider、Root、Trigger 和 Portal 内容，为补充说明提供统一延迟、偏移与视觉层级；它不能承载完成任务所必需的唯一信息或交互控件。
 * 输入沿用 Radix 的开合、触发、内容、位置、样式和 ref 属性，输出在 document Portal 中显示的短文本提示。
 * 悬停/聚焦开合、定时和定位由 Radix 管理，本层无业务状态、持久化或网络副作用；全局 delay 由上层 Provider 统一。
 * 提示内容和触发节点来自调用边界，原语不校验其中数据真实性或 URL，且不能用隐藏提示泄露本不应暴露的敏感信息。
 * Trigger 必须本身可聚焦并有独立名称，关键信息在 Tooltip 不可用时仍需可见；Escape 关闭、Portal 层级和默认 sideOffset 是键盘及布局兼容不变量。
 */
import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-xs overflow-hidden rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-sm",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;
