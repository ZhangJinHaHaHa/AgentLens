import { Route, Routes } from "react-router-dom";

import { ConfigurationErrorState } from "../components/ConfigurationErrorState";
import { ErrorBoundary } from "../components/ErrorBoundary";
import type { AppEnv } from "../config/appConfig";
import { readAppConfig } from "../config/appConfig";
import { AgentDetailPage } from "../pages/AgentDetailPage";
import { AuditReportPage } from "../pages/AuditReportPage";
import { HomePage } from "../pages/HomePage";
import { PopoWelcome } from "../components/PopoWelcome";

interface AppProps {
  env?: AppEnv;
}

export function App({ env = import.meta.env }: AppProps): JSX.Element {
  const configResult = readAppConfig(env);

  if (!configResult.ok) {
    return <ConfigurationErrorState error={configResult.error} />;
  }

  return (
    <ErrorBoundary>
      <PopoWelcome />
      <Routes>
        <Route path="/" element={<HomePage config={configResult.config} />} />
        <Route path="/agent/:tokenId" element={<AgentDetailPage config={configResult.config} />} />
        <Route
          path="/agent/:tokenId/audits/:auditId/:auditIndex"
          element={<AuditReportPage config={configResult.config} />}
        />
      </Routes>
    </ErrorBoundary>
  );
}
