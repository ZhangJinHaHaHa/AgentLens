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
