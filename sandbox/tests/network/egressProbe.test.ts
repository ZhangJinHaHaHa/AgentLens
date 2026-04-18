import test from "node:test";
import assert from "node:assert/strict";

import {
  probeEgress,
  type CommandRunner
} from "../../src/network/egressProbe";

test("probeEgress returns reachable when the container can access the target", async () => {
  const commandRunner: CommandRunner = async (command: string, args: string[]) => {
    assert.equal(command, "docker");
    assert.equal(args[0], "exec");
    assert.equal(args[1], "container-123");
    assert.equal(args[2], "sh");
    assert.equal(args[3], "-lc");
    assert.match(args[4] ?? "", /https:\/\/malicious\.example/);

    return {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
  };

  const result = await probeEgress("container-123", "https://malicious.example", { commandRunner });

  assert.deepEqual(result, {
    reachable: true,
    toolAvailable: true
  });
});

test("probeEgress returns blocked when the request cannot reach the target", async () => {
  const commandRunner: CommandRunner = async () => ({
    stdout: "",
    stderr: "curl: (28) Connection timed out",
    exitCode: 28
  });

  const result = await probeEgress("container-123", "https://malicious.example", { commandRunner });

  assert.deepEqual(result, {
    reachable: false,
    toolAvailable: true
  });
});

test("probeEgress returns toolAvailable false when the container lacks probe tools", async () => {
  const commandRunner: CommandRunner = async () => ({
    stdout: "",
    stderr: "",
    exitCode: 127
  });

  const result = await probeEgress("container-123", "https://malicious.example", { commandRunner });

  assert.deepEqual(result, {
    reachable: false,
    toolAvailable: false
  });
});
