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
