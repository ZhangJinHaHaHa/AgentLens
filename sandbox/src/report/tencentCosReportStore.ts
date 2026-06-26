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

function requireConfigValue(value: string, label: string): string {
  if (!value) {
    throw new Error(`${label} is required`);
  }

  return value;
}

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
