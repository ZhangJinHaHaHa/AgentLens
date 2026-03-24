const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");

const {
  handleMockReportStorageRequest,
  readMockReportStorageConfig
} = require("../../infra/polygon-edge-local/scripts/mock-report-storage-server.js");

function createResponseDouble() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = typeof body === "string" ? body : body?.toString("utf8") ?? "";
    },
    get jsonBody() {
      return this.body ? JSON.parse(this.body) : null;
    }
  };
}

function createRequestDouble({ method, url, headers = {}, body = "" }) {
  const request = Readable.from([Buffer.from(body)]);
  request.method = method;
  request.url = url;
  request.headers = headers;
  return request;
}

describe("mock report storage server", function () {
  it("reads required config from environment", function () {
    assert.deepStrictEqual(
      readMockReportStorageConfig({
        MOCK_REPORT_STORAGE_DIR: "/tmp/mock-store",
        MOCK_REPORT_STORAGE_PORT: "3309",
        MOCK_REPORT_STORAGE_HOST: "127.0.0.1",
        MOCK_REPORT_STORAGE_CID: "QmCustomCid"
      }),
      {
        host: "127.0.0.1",
        port: 3309,
        storageDir: "/tmp/mock-store",
        fixedCid: "QmCustomCid"
      }
    );
  });

  it("stores uploaded report bytes and serves them back by CID", async function () {
    const storageDir = await fs.mkdtemp(path.join(os.tmpdir(), "mock-report-storage."));

    try {
      const config = {
        host: "127.0.0.1",
        port: 3301,
        storageDir,
        fixedCid: "QmYwAPJzv5CZsnAzt8auVTLN9uWw6tG6PvxBUw9u5VnXNf"
      };
      const boundary = "AaB03x";
      const reportJson = '{"schemaVersion":"audit-report.v1"}';
      const uploadBody = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="report.json"',
        "Content-Type: application/json",
        "",
        reportJson,
        `--${boundary}--`,
        ""
      ].join("\r\n");

      const uploadResponse = createResponseDouble();
      await handleMockReportStorageRequest(
        createRequestDouble({
          method: "POST",
          url: "/api/v0/add",
          headers: {
            "content-type": `multipart/form-data; boundary=${boundary}`
          },
          body: uploadBody
        }),
        uploadResponse,
        config
      );

      assert.strictEqual(uploadResponse.statusCode, 200);
      assert.deepStrictEqual(uploadResponse.jsonBody, {
        cid: config.fixedCid
      });

      const storedBytes = await fs.readFile(path.join(storageDir, "ipfs", `${config.fixedCid}.json`), "utf8");
      assert.strictEqual(storedBytes, reportJson);

      const readResponse = createResponseDouble();
      await handleMockReportStorageRequest(
        createRequestDouble({
          method: "GET",
          url: `/ipfs/${config.fixedCid}`
        }),
        readResponse,
        config
      );

      assert.strictEqual(readResponse.statusCode, 200);
      assert.strictEqual(readResponse.headers["content-type"], "application/json");
      assert.strictEqual(readResponse.body, reportJson);
    } finally {
      await fs.rm(storageDir, { recursive: true, force: true });
    }
  });
});
