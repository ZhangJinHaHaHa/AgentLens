/**
 * 定义上手指南在目录与界面之间传递的静态契约：输入由内容源提供，输出形状包含前置条件、首步、分步说明、官方链接和常见陷阱。
 * 本文件只有 TypeScript 类型，不创建运行时对象，不读写状态/缓存，也不会执行代码块、打开链接或发起网络请求。
 * `codeBlock`、双语文案和 URL 可能跨越编辑/卖家信任边界；消费端必须按文本展示代码，并在跳转前限制协议与处理外部站点提示。
 * 可选代码块用于兼容不含命令的旧指南，但类型不会校验运行时 JSON、链接可达性或翻译完整性，这些失败应在内容发布阶段处理而非客户端重试。
 */
import type { I18nText } from "./i18nText";

export interface OnboardingStep {
  title: I18nText;
  body: I18nText;
  /** Optional inline code block; left raw, no syntax highlighting yet. */
  codeBlock?: string;
}

export interface OnboardingDocLink {
  label: I18nText;
  url: string;
}

export interface OnboardingGuide {
  agentId: string;
  prerequisites: I18nText[];
  firstStep: I18nText;
  steps: OnboardingStep[];
  officialDocs: OnboardingDocLink[];
  /** Platform-specific advice that goes beyond the official quickstart. */
  platformAdvice: I18nText;
  commonPitfalls: I18nText[];
}
