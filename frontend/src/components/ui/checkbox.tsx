/**
 * Checkbox 用原生 checkbox 输入、可点击 label 和装饰勾选图标封装一致的选择控件；它不拥有筛选状态、不校验业务组合，也不持久化选值。
 * 输入为除 type 外的原生 input 属性、可选 label/id 与 ref，输出为显式关联的标签和输入；无 id 时使用 `useId` 生成同一渲染树内稳定标识。
 * 受控/非受控状态与 change 副作用完全由浏览器和调用方管理，本组件只根据 disabled/checked CSS 状态呈现。
 * value、checked 和事件来自调用边界，前端勾选绝不等于权限或服务器接受；label 应是安全 React 节点且不得嵌入破坏原生点击语义的交互控件。
 * 输入本身保持键盘焦点和表单语义，视觉图标不可截获指针；label 可省略时调用方必须另给 aria-label/aria-labelledby，禁用态也须由原生属性表达。
 */
import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id ?? React.useId();
    return (
      <label
        htmlFor={inputId}
        className={cn(
          "group relative inline-flex cursor-pointer select-none items-center gap-2 text-sm",
          "text-muted-foreground hover:text-foreground transition-colors",
          props.disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          <input
            id={inputId}
            ref={ref}
            type="checkbox"
            className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded border border-border bg-transparent transition-colors checked:border-foreground checked:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            {...props}
          />
          <Check className="pointer-events-none h-3 w-3 text-background opacity-0 transition-opacity peer-checked:opacity-100" />
        </span>
        {label != null && <span className="text-foreground/90">{label}</span>}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";
