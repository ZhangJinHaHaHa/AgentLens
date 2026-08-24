/**
 * 该轻量下拉菜单以 Popover 作为定位/开合容器，并提供标签、按钮项和分隔线样式；它不是完整的 ARIA menu 实现，也不负责命令路由或选择状态。
 * 输入分别沿用 PopoverContent、div 或 button 属性，输出固定宽度内容和真正可聚焦的 button 菜单项，默认按钮 type 为 button。
 * 开合由 Popover 管理，条目点击副作用属于调用方；本层无业务状态、持久化或网络行为。
 * 条目内容与事件跨调用边界传入，原语不校验命令权限或外部导航；消费者不能依据“菜单”命名假定已有 roving focus、方向键循环或 typeahead。
 * 每个条目必须有可理解文字/名称并正确使用 disabled，Tab/Enter/Space 的原生按钮行为应保留；标签和分隔线只是结构提示，不能成为唯一信息来源。
 */
import * as React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const DropdownMenu = Popover;
export const DropdownMenuTrigger = PopoverTrigger;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof PopoverContent>,
  React.ComponentPropsWithoutRef<typeof PopoverContent>
>(({ className, ...props }, ref) => (
  <PopoverContent
    ref={ref}
    className={cn("w-80 p-1", className)}
    {...props}
  />
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      "theme-menu-item flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors",
      "hover:bg-muted focus:bg-muted disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
