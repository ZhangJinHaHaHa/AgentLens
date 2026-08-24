/**
 * Label 包装 Radix Label 以统一表单标签排版及关联控件禁用态；它不生成控件 id、不验证输入，也不代替错误说明或帮助文本。
 * 输入为 Radix label 属性、子内容、样式和 ref，输出保留 `htmlFor`/嵌套控件行为的标签元素。
 * 组件无状态与副作用，点击聚焦和表单关联由浏览器/Radix 处理，className 仅追加视觉规则。
 * 标签内容与目标 id 来自调用边界，本层不保证二者匹配，也不应渲染未经处理的 HTML；标签存在不意味着输入可信或已通过校验。
 * 调用方必须提供可见且准确的名称并保持唯一关联，禁用样式不能取代真实 disabled；ref 与 Radix 原生语义是兼容不变量。
 */
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;
