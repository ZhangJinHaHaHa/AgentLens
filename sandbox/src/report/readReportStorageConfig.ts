export interface TencentCosReportStorageConfig {
  mode: "tencent";
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
  keyPrefix: string;
}

export interface LocalDirectoryReportStorageConfig {
  mode: "local";
  localDir: string;
  keyPrefix: string;
}

export type ReportStorageCosConfig =
  | TencentCosReportStorageConfig
  | LocalDirectoryReportStorageConfig;

export interface ReportStorageIpfsConfig {
  apiUrl: string;
  authToken?: string;
}

export interface ReportStorageConfig {
  cos: ReportStorageCosConfig;
  ipfs?: ReportStorageIpfsConfig;
}

/**
 * 存储凭据和端点来自受信任的启动环境；本函数只验证存在性，不打印或改写秘密值。
 * 保留原始字符串也意味着空白不是自动修复项，错误配置应在适配器/远端认证处明确失败。
 */
function requireEnvValue(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  key: string
): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

/**
 * 把分散的环境变量折叠为带 `mode` 判别字段的单一快照，后续运行时据此唯一选择
 * Tencent COS 或本地目录适配器。`AUDIT_REPORT_COS_LOCAL_DIR` 的存在具有明确优先级：
 * 它进入本地兼容模式且不再要求云端密钥，便于离线端到端运行而不扩大生产凭据暴露面。
 */
export function readReportStorageConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): ReportStorageConfig {
  // 前缀在这里保留部署值；真正构造对象键时再统一去除首尾斜杠，默认命名空间保持为 `reports`。
  const keyPrefix = env.AUDIT_REPORT_COS_KEY_PREFIX || "reports";
  const localDir = env.AUDIT_REPORT_COS_LOCAL_DIR;
  const ipfsApiUrl = env.AUDIT_REPORT_IPFS_API_URL;
  const cos: ReportStorageCosConfig = localDir
    ? {
        mode: "local",
        localDir,
        keyPrefix
      }
    : {
        mode: "tencent",
        secretId: requireEnvValue(env, "AUDIT_REPORT_COS_SECRET_ID"),
        secretKey: requireEnvValue(env, "AUDIT_REPORT_COS_SECRET_KEY"),
        bucket: requireEnvValue(env, "AUDIT_REPORT_COS_BUCKET"),
        region: requireEnvValue(env, "AUDIT_REPORT_COS_REGION"),
        keyPrefix
      };

  return {
    cos,
    // 本地模式允许暂未配置 IPFS，以兼容“先配置对象目录”的部署准备阶段；Tencent 模式则要求
    // IPFS 端点完整存在。运行时只有 COS/local 与 IPFS 两端都可用时才启用远端双写编排。
    ...(ipfsApiUrl
      ? {
          ipfs: {
            apiUrl: ipfsApiUrl,
            authToken: env.AUDIT_REPORT_IPFS_AUTH_TOKEN
          }
        }
      : localDir
        ? {}
        : {
            ipfs: {
              apiUrl: requireEnvValue(env, "AUDIT_REPORT_IPFS_API_URL"),
              authToken: env.AUDIT_REPORT_IPFS_AUTH_TOKEN
            }
          })
  };
}
