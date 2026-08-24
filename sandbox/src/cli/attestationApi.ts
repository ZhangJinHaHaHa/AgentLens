/**
 * 此 CLI 依据环境配置选择 TEE provider 并启动证明 API，是配置、provider 与 HTTP 服务的组合根；不生成或验证证明语义，也不持久化审计结果。
 * env 可包含认证令牌和真实后端地址/命令，均不得进入启动日志；成功输出仅报告 host、port、模式及“是否配置认证”的布尔信息。
 * 监听套接字与 provider 调用跨越进程/网络/硬件信任边界，任何配置解析、provider 构造或 bind 失败都会拒绝启动并设置非零退出码。
 * 服务创建只发生一次，依赖注入用于隔离外部资源；本入口不负责请求并发限流、关闭信号或 provider 重试，这些能力属于服务器和部署层。
 */
import { createAttestationApiServer } from "../attestation/attestationApiServer";
import { type TeeProvider } from "../attestation/mockTeeProvider";
import {
  type CreateTeeProviderDependencies,
  createTeeProvider,
  type CreateTeeProviderDependencies as TeeProviderDeps
} from "../attestation/createTeeProvider";
import {
  readAttestationServiceConfig,
  type AttestationServiceConfig
} from "../attestation/readAttestationServiceConfig";

interface AttestationApiServerLike {
  once(event: string, handler: (...args: unknown[]) => void): unknown;
  listen(port: number, host: string, callback: () => void): unknown;
}

export interface AttestationApiCliDependencies {
  createServer?: (
    config: AttestationServiceConfig,
    provider: TeeProvider
  ) => AttestationApiServerLike;
  createProvider?: (config: AttestationServiceConfig) => TeeProvider;
  createCommandTeeProvider?: TeeProviderDeps["createCommandTeeProvider"];
  createMockTeeProvider?: CreateTeeProviderDependencies["createMockTeeProvider"];
  createRealTeeHttpProvider?: CreateTeeProviderDependencies["createRealTeeHttpProvider"];
  writeStdout?: (line: string) => void;
}

export async function runAttestationApiCli(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  dependencies: AttestationApiCliDependencies = {}
): Promise<void> {
  const config = readAttestationServiceConfig(env);
  const provider =
    dependencies.createProvider?.(config) ??
    createTeeProvider(config, {
      createCommandTeeProvider: dependencies.createCommandTeeProvider,
      createMockTeeProvider: dependencies.createMockTeeProvider,
      createRealTeeHttpProvider: dependencies.createRealTeeHttpProvider
    });
  const server = (dependencies.createServer ?? createAttestationApiServer)(config, provider);
  const writeStdout = dependencies.writeStdout ?? ((line: string) => process.stdout.write(line));

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      resolve();
    });
  });

  writeStdout(
    `${JSON.stringify({
      type: "attestation-api-listening",
      host: config.host,
      port: config.port,
      providerMode: config.providerMode,
      authTokenConfigured: Boolean(config.authToken)
    })}\n`
  );
}

if (require.main === module) {
  void runAttestationApiCli(process.env).catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
