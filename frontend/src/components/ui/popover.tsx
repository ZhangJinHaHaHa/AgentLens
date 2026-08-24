/**
 * Popover 原语封装 Radix 的触发器、Portal 与浮层定位，统一表面、宽度和默认偏移；它提供非模态浮层，不决定内容语义或业务选择。
 * 输入沿用 Radix 的开合控制、对齐、偏移、子节点、样式和 ref，输出在 document Portal 中定位的内容节点。
 * 开合状态、碰撞计算、外部点击和焦点行为由 Radix/浏览器管理，本层没有业务状态、存储或网络副作用。
 * 浮层内容与事件来自调用边界，组件不校验其中 URL、命令或表单输入；Portal 依赖 DOM，调用者不得假定其在无浏览器环境中拥有相同布局测量。
 * 触发器必须具备正确名称和键盘语义，浮层不能承载只有悬停才能获得的关键内容；默认 align/sideOffset 与 ref 透传是现有消费者的定位兼容契约。
 */
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "surface-card z-50 w-72 p-4 text-popover-foreground outline-none",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;
