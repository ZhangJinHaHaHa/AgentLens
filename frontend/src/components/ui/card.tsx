/**
 * Card 家族只定义内容容器、头部、标题、描述、正文和页脚的稳定表面与间距；它不加载数据、不管理折叠状态，也不赋予内容业务语义。
 * 每个原语接收对应 HTML 属性、子节点、样式与 ref，输出既有 div/p/h3 结构，调用方可按页面需要组合而无需额外包装。
 * 所有组件均无状态和副作用，属性与事件直接透传；布局变化只能来自传入 className 或子内容。
 * 子节点和 DOM 属性由调用方提供，React 负责常规转义，但本层不清洗 dangerouslySetInnerHTML、链接或事件，因此外部内容必须先在实际边界处理。
 * `CardTitle` 固定为 h3，调用方需保持页面标题层级并避免仅靠表面样式表达分组；ref 转发、基础间距和 class 合并顺序是组件兼容不变量。
 */
import * as React from "react";

import { cn } from "@/lib/utils";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "surface-card",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref as unknown as React.Ref<HTMLHeadingElement>}
      className={cn("text-lg font-medium leading-none tracking-tight", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-6 pb-6", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center px-6 pb-6", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";
