/**
 * Input 为原生单行输入统一尺寸、边框、占位、焦点和禁用样式；它不拥有表单值、不做业务校验，也不自动提交或持久化。
 * 输入为完整原生 input 属性、可选 type/className 与 ref，输出同一 DOM input，缺省类型保持 text。
 * controlled/uncontrolled 状态、change 处理、自动填充和表单副作用均由浏览器及调用方所有，本组件无内部状态或 I/O。
 * 用户键入与浏览器自动填充值是不可信输入，样式层不提供清洗、长度、格式或服务器校验；密码、搜索和数字等类型仍需调用方设置正确安全属性。
 * 焦点环和 disabled 状态必须保持原生可用；每个实例需由调用方关联 Label 或 aria-label，placeholder 不能充当唯一可访问名称。
 */
import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "theme-input flex h-10 w-full min-w-0 rounded-md border border-border bg-transparent px-3 py-2 text-sm transition-colors",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
