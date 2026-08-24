/**
 * Switch 封装 Radix 二态开关与滑块外观，提供一致的焦点、禁用和 checked/unchecked 状态样式；它不拥有偏好值、不保存设置，也不执行受保护操作。
 * 输入沿用 Radix 的 checked/defaultChecked、change 回调、disabled、样式和 ref，输出一个可聚焦 Root 及纯视觉 Thumb。
 * 受控或非受控状态与变更副作用由 Radix和调用方管理，本层无网络、存储或业务回滚逻辑。
 * checked 值是客户端交互状态而非服务器授权，调用方必须在持久化或执行前再次验证；透传事件和属性也不能绕过真实权限边界。
 * 每个开关必须由外部 Label 或 aria 属性命名，键盘切换、禁用和焦点环需保留；Thumb 不接收指针，既有尺寸/位移是主题兼容不变量。
 */
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-foreground data-[state=unchecked]:bg-muted",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform",
        "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;
