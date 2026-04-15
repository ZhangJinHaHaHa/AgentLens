import test from "node:test";
import assert from "node:assert/strict";

import {
  checkDockerAvailability
} from "../../src/docker/checkDockerAvailability";
import type { CommandRunner } from "../../src/docker/dockerRunner";

test("checkDockerAvailability returns available when docker info succeeds", async () => {
  const commandRunner: CommandRunner = async (command: string, args: string[]) => {
    assert.equal(command, "docker");
    assert.deepEqual(args, ["info", "--format", "{{.ServerVersion}}"]);

    return {
      stdout: "28.0.4\n",
      stderr: "",
      exitCode: 0
    };
  };

  const result = await checkDockerAvailability({ commandRunner });

  assert.deepEqual(result, {
    available: true,
    serverVersion: "28.0.4"
  });
});

test("checkDockerAvailability returns unavailable when docker daemon is not reachable", async () => {
  const commandRunner: CommandRunner = async () => ({
    stdout: "",
    stderr: "Cannot connect to the Docker daemon at unix:///var/run/docker.sock",
    exitCode: 1
  });

  const result = await checkDockerAvailability({ commandRunner });

  assert.deepEqual(result, {
    available: false,
    reason: "DOCKER_UNAVAILABLE",
    detail: "Cannot connect to the Docker daemon at unix:///var/run/docker.sock"
  });
});

test("checkDockerAvailability returns unavailable when docker info prints daemon error with exit code 0", async () => {
  const commandRunner: CommandRunner = async () => ({
    stdout: "",
    stderr: "Cannot connect to the Docker daemon at unix:///var/run/docker.sock",
    exitCode: 0
  });

  const result = await checkDockerAvailability({ commandRunner });

  assert.deepEqual(result, {
    available: false,
    reason: "DOCKER_UNAVAILABLE",
    detail: "Cannot connect to the Docker daemon at unix:///var/run/docker.sock"
  });
});
