/**
 * Button 统一原生按钮的尺寸、视觉变体、焦点样式，并通过 `asChild` 支持将样式/属性合并到链接等单一子元素；它不拥有业务动作或权限策略。
 * 输入为原生 button 属性、variant/size、可选 Slot 模式与 ref，输出为 button 或调用方提供的语义元素，并暴露稳定的 data-variant/data-size 供主题使用。
 * 原语无自有状态，点击、提交、禁用和异步忙碌均由调用方控制；在表单内调用方必须明确需要的 `type`，避免浏览器默认提交带来隐式副作用。
 * 透传 props、事件处理器和 Slot 子节点属于调用边界，样式组件不验证 URL、操作授权或 disabled 的业务正确性，`asChild` 也不会自动修复错误语义。
 * 焦点环、禁用外观和触控尺寸必须保持一致；图标按钮需由调用方提供可访问名称，新增变体不得改变既有默认尺寸和主题选择器契约。
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background hover:bg-foreground/90",
        secondary:
          "glass-input border text-foreground hover:bg-muted/70",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        link: "text-foreground underline-offset-4 hover:underline",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const resolvedVariant = variant ?? "default";
    const resolvedSize = size ?? "default";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant: resolvedVariant, size: resolvedSize }), "theme-button", className)}
        data-variant={resolvedVariant}
        data-size={resolvedSize}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
