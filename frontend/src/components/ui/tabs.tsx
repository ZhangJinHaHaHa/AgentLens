/**
 * Tabs 封装 Radix 的根、列表、触发器和内容面板，统一横向可滚动导航与激活指示；它不决定标签信息架构，也不自动同步 URL 或数据加载。
 * 输入沿用 Radix 的 value/defaultValue、change 回调、子节点、样式和 ref，输出保持 tab/tablist/tabpanel 关联的组合原语。
 * 选择与键盘焦点由 Radix 管理，受控状态副作用归调用方；内容面板仅在现有 Radix 生命周期内呈现，本层不缓存页面状态。
 * tab value 和面板内容来自调用边界，必须在业务层限制允许值；切换可见性不构成权限隔离，敏感内容不能仅靠未激活面板保护。
 * Trigger 需要可见且唯一的名称，方向键/Tab 焦点关系不得被自定义事件破坏；窄屏横向滚动保持 DOM 顺序，激活状态不能只靠底线颜色表达。
 */
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex h-10 max-w-full items-center justify-start gap-1 overflow-x-auto border-b border-border bg-transparent p-0",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex h-10 items-center justify-center whitespace-nowrap px-3 text-sm font-medium text-muted-foreground transition-colors",
      "hover:text-foreground",
      "focus-visible:outline-none",
      "data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-px data-[state=active]:after:bg-foreground",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-6 focus-visible:outline-none animate-fade-in",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
