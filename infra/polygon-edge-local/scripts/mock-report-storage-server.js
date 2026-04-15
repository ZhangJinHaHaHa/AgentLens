const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    request.on("error", reject);
  });
}

function parseMultipartJson(body, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"?([^";]+)"?)/i);
  if (!boundaryMatch) {
    throw new Error("multipart boundary is missing");
  }

  const boundary = boundaryMatch[1];
  const bodyText = body.toString("utf8");
  const payloadStart = bodyText.indexOf("\r\n\r\n");
  if (payloadStart < 0) {
    throw new Error("multipart payload is missing");
  }

  const closingMarker = `\r\n--${boundary}--`;
  const payloadEnd = bodyText.lastIndexOf(closingMarker);
  if (payloadEnd < 0 || payloadEnd <= payloadStart + 4) {
    throw new Error("multipart payload closing boundary is missing");
  }

  return Buffer.from(bodyText.slice(payloadStart + 4, payloadEnd), "utf8");
}

async function writeStoredReport(storageDir, cid, reportBytes) {
  const outputPath = path.join(storageDir, "ipfs", `${cid}.json`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, reportBytes);
}

async function readStoredReport(storageDir, cid) {
  const inputPath = path.join(storageDir, "ipfs", `${cid}.json`);
  return fs.readFile(inputPath);
}

function writeJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

function readMockReportStorageConfig(env = process.env) {
  const storageDir = env.MOCK_REPORT_STORAGE_DIR;
  if (!storageDir) {
    throw new Error("MOCK_REPORT_STORAGE_DIR is required");
  }

  return {
    host: env.MOCK_REPORT_STORAGE_HOST || "127.0.0.1",
    port: Number.parseInt(env.MOCK_REPORT_STORAGE_PORT || "3301", 10),
    storageDir,
    fixedCid: env.MOCK_REPORT_STORAGE_CID || "QmYwAPJzv5CZsnAzt8auVTLN9uWw6tG6PvxBUw9u5VnXNf"
  };
}

async function handleMockReportStorageRequest(request, response, config) {
  try {
    if (request.method === "GET" && request.url === "/health") {
      writeJson(response, 200, { status: "ok" });
      return undefined;
    }

    if (request.method === "POST" && request.url === "/api/v0/add") {
      const contentType = request.headers["content-type"];
      if (typeof contentType !== "string" || !contentType.includes("multipart/form-data")) {
        writeJson(response, 400, { error: "multipart/form-data content-type is required" });
        return;
      }

      const body = await readRequestBody(request);
      const reportBytes = parseMultipartJson(body, contentType);
      await writeStoredReport(config.storageDir, config.fixedCid, reportBytes);
      writeJson(response, 200, { cid: config.fixedCid });
      return undefined;
    }

    if (request.method === "GET" && request.url && request.url.startsWith("/ipfs/")) {
      const cid = decodeURIComponent(request.url.slice("/ipfs/".length));

      try {
        const reportBytes = await readStoredReport(config.storageDir, cid);
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.end(reportBytes);
      } catch (error) {
        if (error && typeof error === "object" && error.code === "ENOENT") {
          writeJson(response, 404, { error: "not found" });
          return;
        }

        throw error;
      }
      return undefined;
    }

    writeJson(response, 404, { error: "not found" });
  } catch (error) {
    writeJson(response, 500, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function createMockReportStorageServer(config) {
  return http.createServer((request, response) =>
    void handleMockReportStorageRequest(request, response, config)
  );
}

module.exports = {
  createMockReportStorageServer,
  handleMockReportStorageRequest,
  parseMultipartJson,
  readMockReportStorageConfig
};

if (require.main === module) {
  const config = readMockReportStorageConfig(process.env);
  const server = createMockReportStorageServer(config);

  server.listen(config.port, config.host, () => {
    process.stdout.write(
      `${JSON.stringify({
        type: "mock-report-storage-listening",
        host: config.host,
        port: config.port,
        storageDir: config.storageDir,
        cid: config.fixedCid
      })}\n`
    );
  });
}
