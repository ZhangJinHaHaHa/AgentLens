/**
 * 应用装配入口只负责把部署环境解析为稳定的 `AppConfig`，并将成功配置交给路由树；页面取数、导航决策和领域规则不在此处实现。
 * 可选的 `env` 是测试或宿主注入点，输出始终是已挂载全局 Provider 的 React 树，配置失败时则输出独立的启动错误状态。
 * 本组件自身不持有状态；配置读取是同步边界，后续钱包、主题和页面 I/O 的副作用由各自所有者管理。
 * `import.meta.env` 来自构建/部署环境，不能直接当作可信运行参数；`readAppConfig` 的判别结果是进入业务路由前的信任闸门。
 * 不变量是无效配置绝不渲染业务页面、运行期渲染异常由 `ErrorBoundary` 隔离，同时错误分支仍保留国际化与主题上下文以维持一致展示。
 */
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
