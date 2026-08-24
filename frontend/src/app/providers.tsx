/**
 * 集中声明应用级上下文的生命周期和嵌套顺序：国际化包围主题，主题包围钱包，最内层统一提供提示浮层；它不读取页面数据，也不替子组件作业务决策。
 * 输入是任意 React 子树，输出是在同一渲染根内可消费翻译、主题、钱包与 Tooltip 上下文的子树，不改写子节点内容。
 * 此文件没有自有状态，但下游 Provider 会触发语言初始化、主题持久化及钱包浏览器 API 交互；这些副作用不得在这里重复执行。
 * 钱包扩展、浏览器存储和语言探测均处于浏览器信任边界，调用方必须依据各 Provider 暴露的可用/失败状态行事，不能因上下文存在就假定能力可用。
 * Provider 顺序和单实例语义属于兼容不变量；Tooltip 的统一延迟避免各页面出现互相矛盾的键盘、焦点与悬停体验。
 */
import * as React from "react";
import { I18nextProvider } from "react-i18next";

import i18n from "@/i18n/config";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/hooks/useWallet";

import { ThemeProvider } from "./theme";

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps): JSX.Element {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <WalletProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </WalletProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
