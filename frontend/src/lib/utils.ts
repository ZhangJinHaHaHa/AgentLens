/**
 * Tailwind 类名组合边界：先由 clsx 展开条件输入，再由 tailwind-merge 按出现顺序消解冲突，输出一个最终 class 字符串。
 * 本模块不读写 DOM、不维护业务状态或持久缓存，也不发网络请求；后出现的互斥 utility 覆盖前者是组件样式组合的不变量。
 * 该工具不做 CSS 安全过滤，调用方不应把未经允许的用户字符串当类名传入；它只解决开发者控制的样式合并，不是内容转义器。
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
