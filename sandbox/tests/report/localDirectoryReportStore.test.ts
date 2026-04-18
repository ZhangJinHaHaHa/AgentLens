import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createLocalDirectoryReportStore } from "../../src/report/localDirectoryReportStore";

test("createLocalDirectoryReportStore persists uploaded report bytes under the object key path", async () => {
  const baseDir = await mkdtemp(join(tmpdir(), "agent-shenji-local-report-store."));

  try {
    const store = createLocalDirectoryReportStore({
      baseDir
    });

    await store.putObject({
      objectKey: "reports/1/audit/report.json",
      body: Buffer.from('{"hello":"world"}'),
      contentType: "application/json"
    });

    const outputPath = join(baseDir, "reports", "1", "audit", "report.json");
    const fileStat = await stat(outputPath);
    const fileContents = await readFile(outputPath, "utf8");

    assert.equal(fileStat.isFile(), true);
    assert.equal(fileContents, '{"hello":"world"}');
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("createLocalDirectoryReportStore rejects an empty base directory", () => {
  assert.throws(() => createLocalDirectoryReportStore({ baseDir: "" }), /baseDir is required/);
});
