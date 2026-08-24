/**
 * 报告网关 CLI 是反向读取服务的组合根：从环境加载监听/upstream 配置、创建 HTTP server 并在 bind 完成后发出启动事件；不解析报告内容或执行完整性验证。
 * 环境、进入的 HTTP 请求和上游响应均位于网络信任边界，stdout 只公开运行所需的 host、port 与 upstreamBaseUrl，不包含任何凭据。
 * 启动会占用监听端口并向上游发起请求；配置错误、server error 或端口冲突必须使 Promise 拒绝并让进程以非零状态结束。
 * 单进程只创建一个 server，本入口不提供连接限流、重试、TLS 终止或优雅停机；这些非职责必须由 gateway 实现或部署层承担。
 */
import { createReportGatewayServer } from "../report/reportGatewayServer";
import {
  readReportGatewayConfig,
  type ReportGatewayConfig
} from "../report/readReportGatewayConfig";

interface ReportGatewayServerLike {
  once(event: string, handler: (...args: unknown[]) => void): unknown;
  listen(port: number, host: string, callback: () => void): unknown;
}

export interface ReportGatewayCliDependencies {
  createServer?: (config: ReportGatewayConfig) => ReportGatewayServerLike;
  writeStdout?: (line: string) => void;
}

export async function runReportGatewayCli(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  dependencies: ReportGatewayCliDependencies = {}
): Promise<void> {
  const config = readReportGatewayConfig(env);
  const server = (dependencies.createServer ?? createReportGatewayServer)(config);
  const writeStdout = dependencies.writeStdout ?? ((line: string) => process.stdout.write(line));

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      resolve();
    });
  });

  writeStdout(
    `${JSON.stringify({
      type: "report-gateway-listening",
      host: config.host,
      port: config.port,
      upstreamBaseUrl: config.upstreamBaseUrl
    })}\n`
  );
}

if (require.main === module) {
  void runReportGatewayCli(process.env).catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
