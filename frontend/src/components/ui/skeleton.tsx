/**
 * Skeleton 只提供未知尺寸内容的脉冲占位表面，帮助维持加载时布局；它不启动加载、不判断完成状态，也不向用户描述正在加载什么。
 * 输入为 div 属性和尺寸样式，输出单一占位节点；具体数量、宽高与替换时机由数据所有者决定。
 * 组件无状态、定时器或 I/O，动画完全由 CSS 驱动，重复渲染不会推进任何业务生命周期。
 * 透传属性来自调用边界，Skeleton 不能承载或泄露真实数据，也不能被当作服务成功响应的证据。
 * 占位本身通常应从辅助技术隐藏，调用方需在容器提供恰当的 status/live 文本；动画偏好与 reduced-motion 由全局样式负责，尺寸应避免加载完成时显著跳动。
 */
import * as React from "react";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
