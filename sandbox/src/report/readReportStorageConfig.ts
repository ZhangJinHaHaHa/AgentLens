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
  ipfs: ReportStorageIpfsConfig;
}

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

export function readReportStorageConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): ReportStorageConfig {
  const keyPrefix = env.AUDIT_REPORT_COS_KEY_PREFIX || "reports";
  const localDir = env.AUDIT_REPORT_COS_LOCAL_DIR;

  return {
    cos: localDir
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
        },
    ipfs: {
      apiUrl: requireEnvValue(env, "AUDIT_REPORT_IPFS_API_URL"),
      authToken: env.AUDIT_REPORT_IPFS_AUTH_TOKEN
    }
  };
}
