import test from "node:test";
import assert from "node:assert/strict";

import {
  collectResourceUsage,
  parseDockerStatsLine,
  type CommandRunner
} from "../../src/monitor/resourceMonitor";

test("parseDockerStatsLine converts docker stats output into cpu and memory metrics", () => {
  const metrics = parseDockerStatsLine("12.5%;256MiB / 512MiB");

  assert.deepEqual(metrics, {
    cpuAvgMilli: 125,
    memoryPeakMb: 256
  });
});

test("collectResourceUsage reads docker stats once and returns normalized metrics", async () => {
  const commandRunner: CommandRunner = async (command, args) => {
    assert.equal(command, "docker");
    assert.deepEqual(args, ["stats", "--no-stream", "--format", "{{.CPUPerc}};{{.MemUsage}}", "container-123"]);

    return {
      stdout: "12.5%;256MiB / 512MiB\n",
      stderr: "",
      exitCode: 0
    };
  };

  const metrics = await collectResourceUsage("container-123", { commandRunner });

  assert.deepEqual(metrics, {
    cpuAvgMilli: 125,
    memoryPeakMb: 256
  });
});
