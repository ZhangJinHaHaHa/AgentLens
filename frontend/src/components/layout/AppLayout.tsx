/**
 * 应用布局拥有跨页面稳定的导航、主内容、页脚、艺术背景及路由级 Suspense 边界；具体页面内容和数据生命周期由 `Outlet` 对应页面负责。
 * 输入是已校验配置（保留在布局公共契约中），输出为完整页面壳；路由变化时仅消费 pathname/hash 来恢复片段定位。
 * 唯一自有副作用是用下一帧滚动到 hash 目标，并在依赖变化或卸载时取消未执行帧；它不保存滚动位置，也不发起 I/O。
 * URL hash 是用户可控浏览器输入，解码后的值只用于 `getElementById`，绝不能扩展为选择器或 HTML；目标缺失时必须静默退化。
 * `<main>` 保持唯一主要内容地标，懒加载占位以 `role=status` 和 polite live region 通知辅助技术；背景始终隐藏，路由切换不得遗留旧帧副作用。
 */
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
