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
      providerMode: config.providerMode
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
