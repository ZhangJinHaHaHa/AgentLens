import test from "node:test";
import assert from "node:assert/strict";

import { readReportStorageConfig } from "../../src/report/readReportStorageConfig";

const baseEnv = {
  AUDIT_REPORT_COS_SECRET_ID: "secret-id",
  AUDIT_REPORT_COS_SECRET_KEY: "secret-key",
  AUDIT_REPORT_COS_BUCKET: "audit-bucket",
  AUDIT_REPORT_COS_REGION: "ap-shanghai",
  AUDIT_REPORT_IPFS_API_URL: "https://ipfs.example/add",
  AUDIT_REPORT_IPFS_AUTH_TOKEN: "token-123"
};

test("readReportStorageConfig rejects missing required COS and IPFS env vars", () => {
  assert.throws(
    () =>
      readReportStorageConfig({
        ...baseEnv,
        AUDIT_REPORT_COS_SECRET_ID: ""
      }),
    /AUDIT_REPORT_COS_SECRET_ID is required/
  );
  assert.throws(
    () =>
      readReportStorageConfig({
        ...baseEnv,
        AUDIT_REPORT_COS_SECRET_KEY: ""
      }),
    /AUDIT_REPORT_COS_SECRET_KEY is required/
  );
  assert.throws(
    () =>
      readReportStorageConfig({
        ...baseEnv,
        AUDIT_REPORT_COS_BUCKET: ""
      }),
    /AUDIT_REPORT_COS_BUCKET is required/
  );
  assert.throws(
    () =>
      readReportStorageConfig({
        ...baseEnv,
        AUDIT_REPORT_COS_REGION: ""
      }),
    /AUDIT_REPORT_COS_REGION is required/
  );
  assert.throws(
    () =>
      readReportStorageConfig({
        ...baseEnv,
        AUDIT_REPORT_IPFS_API_URL: ""
      }),
    /AUDIT_REPORT_IPFS_API_URL is required/
  );
});

test("readReportStorageConfig returns one canonical config object with defaults", () => {
  const config = readReportStorageConfig({
    ...baseEnv,
    AUDIT_REPORT_COS_KEY_PREFIX: undefined
  });

  assert.deepEqual(config, {
    cos: {
      mode: "tencent",
      secretId: "secret-id",
      secretKey: "secret-key",
      bucket: "audit-bucket",
      region: "ap-shanghai",
      keyPrefix: "reports"
    },
    ipfs: {
      apiUrl: "https://ipfs.example/add",
      authToken: "token-123"
    }
  });
});

test("readReportStorageConfig supports a local filesystem COS adapter for local e2e", () => {
  const config = readReportStorageConfig({
    AUDIT_REPORT_COS_LOCAL_DIR: "/tmp/report-storage/cos",
    AUDIT_REPORT_COS_KEY_PREFIX: "local-prefix",
    AUDIT_REPORT_IPFS_API_URL: "http://127.0.0.1:3301/api/v0/add"
  });

  assert.deepEqual(config, {
    cos: {
      mode: "local",
      localDir: "/tmp/report-storage/cos",
      keyPrefix: "local-prefix"
    },
    ipfs: {
      apiUrl: "http://127.0.0.1:3301/api/v0/add",
      authToken: undefined
    }
  });
});
