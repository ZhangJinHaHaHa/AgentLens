/**
 * 路由层定义受支持语言下的页面拓扑、代码分包边界与兜底导航；它只编排页面，不拥有目录、审计或钱包数据。
 * 输入为已经校验的 `AppConfig` 和浏览器当前位置，输出为对应页面元素；未知路径返回可恢复的未找到页面，缺失语言前缀则生成规范化地址。
 * 页面模块通过 `lazy` 异步加载，分包失败交由上层错误边界处理；本文件除导航替换外不持久化状态或发起网络请求。
 * 地址栏的路径、查询串和片段标识都属于用户可控输入，只有白名单语言段会被接受，重定向必须原样保留 query/hash 且不能形成历史栈循环。
 * 兼容不变量是默认语言只补一次、现有合法语言不被改写，并保持布局中的 Suspense/语义主区域负责加载与可访问性反馈。
 */
import { lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { AppLayout } from "@/components/layout/AppLayout";
import type { AppConfig } from "@/config/appConfig";
import { ConfigurationErrorState } from "@/components/system/ConfigurationErrorState";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  SUPPORTED_LOCALES
} from "@/i18n/config";
import { PlaceholderPage } from "@/pages/PlaceholderPage";

const AgentDetailPage = lazy(() => import("@/pages/AgentDetailPage").then(m => ({ default: m.AgentDetailPage })));
const AgentListPage = lazy(() => import("@/pages/AgentListPage").then(m => ({ default: m.AgentListPage })));
const AuditReportPage = lazy(() => import("@/pages/AuditReportPage").then(m => ({ default: m.AuditReportPage })));
const HomePage = lazy(() => import("@/pages/HomePage").then(m => ({ default: m.HomePage })));
const ComparePage = lazy(() => import("@/pages/ComparePage").then(m => ({ default: m.ComparePage })));

interface AppRoutesProps {
  config: AppConfig;
}

function LocaleRedirect(): JSX.Element {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const target = segments.length > 0 && isSupportedLocale(segments[0])
    ? segments.join("/")
    : `${DEFAULT_LOCALE}${location.pathname === "/" ? "" : location.pathname}`;
  return <Navigate to={`/${target}${location.search}${location.hash}`} replace />;
}

function NotFoundPage(): JSX.Element {
  const { t } = useTranslation("detail");
  return (
    <PlaceholderPage
      title={t("errors.notFound")}
      description={t("errors.tryHome")}
      ctaHref="/agents"
    />
  );
}

export function AppRoutes({ config }: AppRoutesProps): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LocaleRedirect />} />
      {SUPPORTED_LOCALES.map((locale) => (
        <Route key={locale} path={`/${locale}`}>
          <Route element={<AppLayout config={config} />}>
            <Route index element={<HomePage config={config} />} />
            <Route path="agents" element={<AgentListPage config={config} />} />
            <Route path="agent/:id" element={<AgentDetailPage config={config} />} />
            <Route
              path="agent/:id/audits/:auditId/:auditIndex"
              element={<AuditReportPage config={config} />}
            />
            <Route path="compare" element={<ComparePage config={config} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      ))}
      <Route path="*" element={<LocaleRedirect />} />
    </Routes>
  );
}

export function ConfigErrorBoundary({ error }: { error: string }): JSX.Element {
  return <ConfigurationErrorState error={error} />;
}
