/**
 * 启动配置错误页在业务路由不可安全构建时提供可操作诊断；它只显示解析器给出的已处理错误和环境文件指引，不尝试修复配置或继续启动。
 * 输入是一段错误说明，输出为占满视口的单一卡片；没有回调、重试或隐式默认配置。
 * 组件无状态、无网络与存储副作用，因此在其余业务依赖不可用时仍应可靠渲染。
 * 错误文本来自部署配置信任边界，React 必须按纯文本转义；上游不得把密钥值写入该字符串，因为页面和屏幕共享都可能公开显示它。
 * 可见警告文字、标题、说明和可横向滚动的详情共同传义，不能只依赖图标/颜色；缺失配置始终阻断业务树是失败安全与部署兼容不变量。
 */
import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ConfigurationErrorStateProps {
  error: string;
}

export function ConfigurationErrorState({ error }: ConfigurationErrorStateProps): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-wide">Configuration error</span>
          </div>
          <CardTitle>AgentLens needs an environment value before it can boot</CardTitle>
          <CardDescription>
            Set the missing variable in your <code className="font-mono text-xs">.env</code> (see
            <code className="ml-1 font-mono text-xs">frontend/.env.example</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs text-foreground">
            {error}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
