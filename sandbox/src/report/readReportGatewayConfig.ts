export interface ReportGatewayConfig {
  host: string;
  port: number;
  upstreamBaseUrl: string;
  authToken?: string;
  fetchTimeoutMs: number;
}

/**
 * 环境变量是进程启动时的配置边界。必填 URL 会去除首尾空白后再判空；令牌则在返回对象中
 * 保持原值，避免无意改变凭据。返回配置是一次快照，运行中的服务不会随 `process.env` 变化。
 */
function requireEnvValue(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  key: string
): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

// 只接受十进制数字，避免 `Number` 对符号、小数、指数或部分字符串的宽松兼容造成误配置。
function readNonNegativeInteger(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  key: string,
  defaultValue: number
): number {
  const rawValue = env[key];
  if (rawValue === undefined || rawValue === "") {
    return defaultValue;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${key} must be a non-negative integer`);
  }

  return Number(rawValue);
}

/**
 * 在创建监听套接字前完成端口和超时校验，使部署错误以启动失败而不是请求期随机故障呈现。
 * 端口 0 被有意保留给操作系统分配临时端口（测试/嵌入场景）；上游 URL 与认证令牌属于
 * 受信任部署配置，后续会被网关用于服务器侧请求，不能由入站请求覆盖。
 */
export function readReportGatewayConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): ReportGatewayConfig {
  const port = readNonNegativeInteger(env, "AUDIT_REPORT_GATEWAY_PORT", 3101);
  const fetchTimeoutMs = readNonNegativeInteger(
    env,
    "AUDIT_REPORT_GATEWAY_FETCH_TIMEOUT_MS",
    15000
  );

  if (port > 65535) {
    throw new Error("AUDIT_REPORT_GATEWAY_PORT must be between 0 and 65535");
  }

  if (fetchTimeoutMs <= 0) {
    throw new Error("AUDIT_REPORT_GATEWAY_FETCH_TIMEOUT_MS must be a positive integer");
  }

  return {
    host: env.AUDIT_REPORT_GATEWAY_HOST || "0.0.0.0",
    port,
    upstreamBaseUrl: normalizeBaseUrl(
      requireEnvValue(env, "AUDIT_REPORT_GATEWAY_UPSTREAM_BASE_URL")
    ),
    authToken: env.AUDIT_REPORT_GATEWAY_AUTH_TOKEN,
    fetchTimeoutMs
  };
}

/**
 * 网关通过字符串拼接附加经过编码的 CID，统一尾斜杠可避免生成错误路径。
 * 这是既有配置格式的兼容归一化，不承担协议白名单或 SSRF 校验；部署方仍需约束上游地址。
 */
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
