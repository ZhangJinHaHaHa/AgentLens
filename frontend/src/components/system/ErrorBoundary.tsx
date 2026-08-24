/**
 * 顶层错误边界隔离后代渲染/生命周期异常，并对部署后旧分包失效执行“每路径至多一次”的自动刷新恢复；它捕获不了事件处理器、定时器或任意 Promise 拒绝。
 * 输入为子树及可选自定义 fallback，输出正常子树或故障卡片；导出的识别与恢复函数允许在无真实浏览器的环境中验证重载策略。
 * 状态只保存最近 Error；捕获后会记录控制台，分包错误还会读写 sessionStorage 并可能 reload，存储异常被降级为警告而不覆盖原始故障。
 * Error 的 message/stack、pathname 和会话存储都跨越浏览器信任边界，重载标记必须按路径隔离；错误详情可能包含敏感上下文，上游日志与抛错方应避免携带秘密。
 * 自定义 fallback 优先级、非分包错误不重载、同一路径不循环刷新是可靠性不变量；默认卡片有可读标题与显式刷新按钮，不能仅靠控制台向用户报告失败。
 */
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

const CHUNK_LOAD_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i;

export function isChunkLoadError(error: Error): boolean {
  return CHUNK_LOAD_ERROR_PATTERN.test(error.message) || CHUNK_LOAD_ERROR_PATTERN.test(error.stack ?? "");
}

export function chunkReloadKey(pathname: string): string {
  return `agentlens:chunk-reload:${pathname}`;
}

interface ChunkLoadRecoveryEnvironment {
  pathname: string;
  getReloadMarker: (key: string) => string | null;
  setReloadMarker: (key: string, value: string) => void;
  reload: () => void;
}

export function recoverFromChunkLoadError(error: Error, environment: ChunkLoadRecoveryEnvironment): boolean {
  if (!isChunkLoadError(error)) return false;

  const key = chunkReloadKey(environment.pathname);
  if (environment.getReloadMarker(key) === "1") return false;

  environment.setReloadMarker(key, "1");
  environment.reload();
  return true;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (typeof console !== "undefined") {
      console.error("[AgentLens] uncaught error", error, info.componentStack);
    }
    if (typeof window !== "undefined") {
      try {
        recoverFromChunkLoadError(error, {
          pathname: window.location.pathname,
          getReloadMarker: (key) => window.sessionStorage.getItem(key),
          setReloadMarker: (key, value) => window.sessionStorage.setItem(key, value),
          reload: () => window.location.reload()
        });
      } catch (recoveryError) {
        console.warn("[AgentLens] chunk recovery failed", recoveryError);
      }
    }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>{this.state.error.message}</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs">
                {this.state.error.stack ?? this.state.error.message}
              </pre>
              {isChunkLoadError(this.state.error) ? (
                <Button type="button" className="mt-4" onClick={() => window.location.reload()}>
                  Refresh page
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
