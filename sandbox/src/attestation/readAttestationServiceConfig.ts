/**
 * 该解析器负责证明服务进程的部署契约：监听地址、鉴权，以及 real-http/command 后端各自必需的连接参数和 quote 期望。
 * 环境变量属于运维输入；公网通配监听若没有 API token 会被立即拒绝，端口和后端超时也必须是正整数，以免用危险默认值启动服务。
 * command 参数兼容逗号或换行分隔的既有配置，解析只生成参数数组，不解析 shell、不启动程序；真实 URL 的连通性和网络出口限制必须由部署策略与运行环境另行保证。
 * 模式专属缺项在启动前失败，未知模式的最终 fail-closed 判断留给 provider factory，从而保持配置解析与实现选择的职责分离。
 * 函数纯读取传入记录且不写进程状态，失败发生在服务监听或后端副作用之前，无需回滚。
 */
export interface AttestationServiceConfig {
  host: string;
  port: number;
  providerMode: string;
  authToken?: string;
  commandBackend?: {
    command: string;
    args: string[];
    providerType: string;
    timeoutMs: number;
    quoteValidation?: {
      expectedProviderType?: string;
      expectedMeasurement?: string;
      expectedQuoteFormat?: string;
    };
  };
  realBackend?: {
    backendUrl: string;
    authToken?: string;
    providerType: string;
    timeoutMs: number;
    quoteValidation?: {
      expectedProviderType?: string;
      expectedMeasurement?: string;
      expectedQuoteFormat?: string;
    };
  };
}

export function readAttestationServiceConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): AttestationServiceConfig {
  const providerMode = env.AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE;
  if (!providerMode) {
    throw new Error("AUDIT_ATTESTATION_SERVICE_PROVIDER_MODE is required");
  }

  const portInput = env.AUDIT_ATTESTATION_SERVICE_PORT || "3311";
  const port = Number.parseInt(portInput, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("AUDIT_ATTESTATION_SERVICE_PORT must be a positive integer");
  }

  const host = env.AUDIT_ATTESTATION_SERVICE_HOST || "127.0.0.1";
  const authToken = env.AUDIT_ATTESTATION_API_TOKEN;
  if (isPublicBindHost(host) && !authToken) {
    throw new Error(
      "AUDIT_ATTESTATION_API_TOKEN is required when AUDIT_ATTESTATION_SERVICE_HOST is public."
    );
  }

  if (providerMode === "real-http") {
    const backendUrl = env.AUDIT_ATTESTATION_REAL_BACKEND_URL;
    if (!backendUrl) {
      throw new Error("AUDIT_ATTESTATION_REAL_BACKEND_URL is required");
    }

    const timeoutInput = env.AUDIT_ATTESTATION_REAL_BACKEND_TIMEOUT_MS || "10000";
    const timeoutMs = Number.parseInt(timeoutInput, 10);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("AUDIT_ATTESTATION_REAL_BACKEND_TIMEOUT_MS must be a positive integer");
    }

    return {
      host,
      port,
      providerMode,
      ...(authToken ? { authToken } : {}),
      realBackend: {
        backendUrl,
        authToken: env.AUDIT_ATTESTATION_REAL_BACKEND_AUTH_TOKEN,
        providerType: env.AUDIT_ATTESTATION_REAL_PROVIDER_TYPE || "real-http",
        timeoutMs,
        quoteValidation: {
          expectedProviderType: env.AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE,
          expectedMeasurement: env.AUDIT_ATTESTATION_EXPECTED_MEASUREMENT,
          expectedQuoteFormat: env.AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT
        }
      }
    };
  }

  if (providerMode === "command") {
    const command = env.AUDIT_ATTESTATION_COMMAND;
    if (!command) {
      throw new Error("AUDIT_ATTESTATION_COMMAND is required");
    }

    const timeoutInput = env.AUDIT_ATTESTATION_COMMAND_TIMEOUT_MS || "10000";
    const timeoutMs = Number.parseInt(timeoutInput, 10);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("AUDIT_ATTESTATION_COMMAND_TIMEOUT_MS must be a positive integer");
    }

    const args = (env.AUDIT_ATTESTATION_COMMAND_ARGS || "")
      .split(/\r?\n/u)
      .flatMap((line) => line.split(","))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    return {
      host,
      port,
      providerMode,
      ...(authToken ? { authToken } : {}),
      commandBackend: {
        command,
        args,
        providerType: env.AUDIT_ATTESTATION_COMMAND_PROVIDER_TYPE || "command-tee",
        timeoutMs,
        quoteValidation: {
          expectedProviderType: env.AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE,
          expectedMeasurement: env.AUDIT_ATTESTATION_EXPECTED_MEASUREMENT,
          expectedQuoteFormat: env.AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT
        }
      }
    };
  }

  return {
    host,
    port,
    providerMode,
    ...(authToken ? { authToken } : {})
  };
}

function isPublicBindHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "0.0.0.0" || normalized === "::" || normalized === "[::]" || normalized === "";
}
