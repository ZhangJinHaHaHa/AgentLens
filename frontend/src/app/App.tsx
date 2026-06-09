import type { AppEnv } from "@/config/appConfig";
import { readAppConfig } from "@/config/appConfig";
import { ErrorBoundary } from "@/components/system/ErrorBoundary";

import { AppProviders } from "./providers";
import { AppRoutes, ConfigErrorBoundary } from "./routes";

interface AppProps {
  env?: AppEnv;
}

export function App({ env = import.meta.env }: AppProps): JSX.Element {
  const configResult = readAppConfig(env);

  return (
    <AppProviders>
      {configResult.ok ? (
        <ErrorBoundary>
          <AppRoutes config={configResult.config} />
        </ErrorBoundary>
      ) : (
        <ConfigErrorBoundary error={configResult.error} />
      )}
    </AppProviders>
  );
}
