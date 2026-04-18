import test from "node:test";
import assert from "node:assert/strict";

import { createTencentCosReportStore } from "../../src/report/tencentCosReportStore";

class FakeCos {
  public readonly clientOptions: { SecretId: string; SecretKey: string };
  public lastPutObjectParams?: Record<string, unknown>;

  constructor(options: { SecretId: string; SecretKey: string }) {
    this.clientOptions = options;
  }

  putObject(params: Record<string, unknown>, callback: (err: Error | null) => void): void {
    this.lastPutObjectParams = params;
    callback(null);
  }
}

test("createTencentCosReportStore calls COS putObject with deterministic key and json content-type", async () => {
  let createdClient: FakeCos | undefined;
  const store = createTencentCosReportStore(
    {
      secretId: "secret-id",
      secretKey: "secret-key",
      bucket: "audit-bucket",
      region: "ap-shanghai"
    },
    {
      CosConstructor: class extends FakeCos {
        constructor(options: { SecretId: string; SecretKey: string }) {
          super(options);
          createdClient = this;
        }
      }
    }
  );

  const body = Buffer.from('{"ok":true}');
  const objectKey =
    "reports/1/0xabc-0/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.json";

  await store.putObject({
    objectKey,
    body,
    contentType: "application/json"
  });

  assert.ok(createdClient);
  assert.deepEqual(createdClient.clientOptions, { SecretId: "secret-id", SecretKey: "secret-key" });
  assert.deepEqual(createdClient.lastPutObjectParams, {
    Bucket: "audit-bucket",
    Region: "ap-shanghai",
    Key: objectKey,
    Body: body,
    ContentType: "application/json"
  });
});

test("createTencentCosReportStore rejects missing required config", () => {
  assert.throws(
    () =>
      createTencentCosReportStore(
        {
          secretId: "",
          secretKey: "secret-key",
          bucket: "audit-bucket",
          region: "ap-shanghai"
        },
        { CosConstructor: FakeCos }
      ),
    /secretId is required/
  );
});
