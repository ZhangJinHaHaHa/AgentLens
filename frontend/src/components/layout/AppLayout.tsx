import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import type { AppConfig } from "@/config/appConfig";
import { Footer } from "./Footer";
import { NavHeader } from "./NavHeader";

export function AppLayout({ config }: { config: AppConfig }): JSX.Element {
  const location = useLocation();
  void config;

  useEffect(() => {
    if (!location.hash) return;

    const id = decodeURIComponent(location.hash.slice(1));
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.pathname]);

  return (
    <div className="relative isolate flex min-h-screen flex-col text-foreground">
      <div className="art-backdrop" aria-hidden="true" />
      <div className="art-backdrop-glass" aria-hidden="true" />

      <NavHeader />
      <main className="relative z-10 flex-1">
        <Suspense fallback={<RouteSectionLoading />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

function RouteSectionLoading(): JSX.Element {
  return (
    <div className="route-section-loading" role="status" aria-live="polite">
      <span>AgentLens</span>
    </div>
  );
}
