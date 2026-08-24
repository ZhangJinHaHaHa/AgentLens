export interface TencentCosReportStoreConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export interface TencentCosReportStore {
  putObject(input: {
    objectKey: string;
    body: Buffer;
    contentType: "application/json";
  }): Promise<void>;
}

type CosPutObjectCallback = (err: Error | null) => void;

interface CosClient {
  putObject(
    params: {
      Bucket: string;
      Region: string;
      Key: string;
      Body: Buffer;
      ContentType: string;
    },
    callback: CosPutObjectCallback
  ): void;
}

type CosConstructor = new (options: { SecretId: string; SecretKey: string }) => CosClient;

// 云端配置在客户端构造期一次性校验；秘密只传给 SDK，不进入适配器日志或自定义错误文本。
function requireConfigValue(value: string, label: string): string {
  if (!value) {
    throw new Error(`${label} is required`);
  }

  return value;
}

/**
 * 创建并持有一个可复用的 COS SDK 客户端。构造器注入只作为测试/宿主集成边界；
 * 默认实现延迟加载可选 SDK，使选择本地目录模式的安装无需携带腾讯云依赖。
 * 适配器不保存对象版本或完成状态，远端 bucket 是持久化状态的实际所有者。
 */
export function createTencentCosReportStore(
  config: TencentCosReportStoreConfig,
  deps?: { CosConstructor?: CosConstructor }
): TencentCosReportStore {
  const secretId = requireConfigValue(config.secretId, "secretId");
  const secretKey = requireConfigValue(config.secretKey, "secretKey");
  const bucket = requireConfigValue(config.bucket, "bucket");
  const region = requireConfigValue(config.region, "region");
  const Constructor = deps?.CosConstructor ?? loadTencentCosConstructor();
  const client = new Constructor({ SecretId: secretId, SecretKey: secretKey });

  return {
    async putObject({ objectKey, body, contentType }): Promise<void> {
      // 将 SDK 回调收敛为 Promise，但保持单次 putObject 语义：本层不增加超时、重试或错误吞并。
      // 确定性 Key 在同字节重放时可实现业务幂等；不同字节会遵循 bucket 的覆盖/版本配置。
      await new Promise<void>((resolve, reject) => {
        client.putObject(
          {
            Bucket: bucket,
            Region: region,
            Key: objectKey,
            Body: body,
            ContentType: contentType
          },
          (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          }
        );
      });
    }
  };
}

/**
 * 只有实际选择 Tencent 模式时才解析 SDK。加载或模块初始化失败统一转换为可操作的部署提示，
 * 不回显凭据；这也是本地模式与默认安装保持兼容的关键边界。
 */
function loadTencentCosConstructor(): CosConstructor {
  try {
    // Loaded lazily so the default production install can omit the optional
    // Tencent COS SDK when audit reports are stored in the local report store.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loaded = require("cos-nodejs-sdk-v5") as { default?: unknown };
    return (loaded.default ?? loaded) as CosConstructor;
  } catch (error) {
    throw new Error(
      "Tencent COS report storage requires optional dependency cos-nodejs-sdk-v5. " +
      "Install cos-nodejs-sdk-v5 in the sandbox service or set AUDIT_REPORT_COS_LOCAL_DIR."
    );
  }
}
