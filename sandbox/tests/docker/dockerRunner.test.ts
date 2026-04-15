import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_CPU, DEFAULT_MEMORY_MB, PORT } from "../../src/config/constants";
import {
  killContainer,
  pullImage,
  startContainer,
  stopContainer,
  removeContainer,
  type CommandRunner,
  type StartedContainer
} from "../../src/docker/dockerRunner";

test("pullImage invokes docker pull when the image is not present locally", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const commandRunner: CommandRunner = async (command, args) => {
    calls.push({ command, args });

    if (args[0] === "image" && args[1] === "inspect") {
      return {
        stdout: "",
        stderr: "Error: No such image",
        exitCode: 1
      };
    }

    return {
      stdout: "pulled\n",
      stderr: "",
      exitCode: 0
    };
  };

  await pullImage(
    {
      agent_name: "risk-agent",
      image: "registry.example.com/agents/risk-agent:1.0.0",
      allowed_hosts: ["api.risk.com"],
      allowed_rpc_endpoints: ["https://rpc.edge.local"]
    },
    { commandRunner }
  );

  assert.deepEqual(calls, [
    {
      command: "docker",
      args: ["image", "inspect", "registry.example.com/agents/risk-agent:1.0.0"]
    },
    {
      command: "docker",
      args: ["pull", "registry.example.com/agents/risk-agent:1.0.0"]
    }
  ]);
});

test("pullImage skips docker pull when the image already exists locally", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const commandRunner: CommandRunner = async (command, args) => {
    calls.push({ command, args });
    return {
      stdout: "sha256:local-image\n",
      stderr: "",
      exitCode: 0
    };
  };

  await pullImage(
    {
      agent_name: "local-test-agent",
      image: "agent-shenji/test-agent:local",
      allowed_hosts: ["example.com"],
      allowed_rpc_endpoints: ["https://example.com"]
    },
    { commandRunner }
  );

  assert.deepEqual(calls, [
    {
      command: "docker",
      args: ["image", "inspect", "agent-shenji/test-agent:local"]
    }
  ]);
});

test("startContainer builds a docker run command with fixed port and resource limits", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const commandRunner: CommandRunner = async (command, args) => {
    calls.push({ command, args });
    return {
      stdout: "container-123\n",
      stderr: "",
      exitCode: 0
    };
  };

  const started: StartedContainer = await startContainer(
    {
      agent_name: "risk-agent",
      image: "registry.example.com/agents/risk-agent:1.0.0",
      allowed_hosts: ["api.risk.com"],
      allowed_rpc_endpoints: ["https://rpc.edge.local"]
    },
    {
      commandRunner,
      hostPort: 18080,
      getDnsServers: async () => ["192.168.65.7"],
      resolveHost: async (host: string) => {
        if (host === "api.risk.com") {
          return ["203.0.113.10"];
        }

        if (host === "rpc.edge.local") {
          return ["198.51.100.7"];
        }

        throw new Error(`unexpected host: ${host}`);
      }
    }
  );

  assert.equal(started.containerId, "container-123");
  assert.equal(started.host, "127.0.0.1");
  assert.equal(started.port, 18080);
  assert.deepEqual(calls, [
    {
      command: "docker",
      args: [
        "run",
        "-d",
        "--rm",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--cap-add",
        "NET_ADMIN",
        "--security-opt",
        "no-new-privileges",
        "--pids-limit",
        "128",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=64m",
        "--memory",
        `${DEFAULT_MEMORY_MB}m`,
        "--cpus",
        `${DEFAULT_CPU}`,
        "-e",
        "SANDBOX_ALLOWED_HOSTS=api.risk.com",
        "-e",
        "SANDBOX_ALLOWED_RPC_ENDPOINTS=https://rpc.edge.local",
        "-e",
        "SANDBOX_DENIED_CIDRS=127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16",
        "-p",
        "18080:8080",
        "registry.example.com/agents/risk-agent:1.0.0"
      ]
    },
    {
      command: "docker",
      args: ["exec", "container-123", "sh", "-lc", "iptables -F OUTPUT"]
    },
    {
      command: "docker",
      args: ["exec", "container-123", "sh", "-lc", "iptables -P OUTPUT DROP"]
    },
    {
      command: "docker",
      args: ["exec", "container-123", "sh", "-lc", "iptables -A OUTPUT -o lo -j ACCEPT"]
    },
    {
      command: "docker",
      args: [
        "exec",
        "container-123",
        "sh",
        "-lc",
        "iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT"
      ]
    },
    {
      command: "docker",
      args: [
        "exec",
        "container-123",
        "sh",
        "-lc",
        "iptables -A OUTPUT -p udp -d 192.168.65.7 --dport 53 -j ACCEPT"
      ]
    },
    {
      command: "docker",
      args: [
        "exec",
        "container-123",
        "sh",
        "-lc",
        "iptables -A OUTPUT -p tcp -d 192.168.65.7 --dport 53 -j ACCEPT"
      ]
    },
    {
      command: "docker",
      args: ["exec", "container-123", "sh", "-lc", "iptables -A OUTPUT -d 10.0.0.0/8 -j DROP"]
    },
    {
      command: "docker",
      args: ["exec", "container-123", "sh", "-lc", "iptables -A OUTPUT -d 127.0.0.0/8 -j DROP"]
    },
    {
      command: "docker",
      args: ["exec", "container-123", "sh", "-lc", "iptables -A OUTPUT -d 169.254.0.0/16 -j DROP"]
    },
    {
      command: "docker",
      args: ["exec", "container-123", "sh", "-lc", "iptables -A OUTPUT -d 172.16.0.0/12 -j DROP"]
    },
    {
      command: "docker",
      args: ["exec", "container-123", "sh", "-lc", "iptables -A OUTPUT -d 192.168.0.0/16 -j DROP"]
    },
    {
      command: "docker",
      args: ["exec", "container-123", "sh", "-lc", "iptables -A OUTPUT -d 198.51.100.7 -j ACCEPT"]
    },
    {
      command: "docker",
      args: ["exec", "container-123", "sh", "-lc", "iptables -A OUTPUT -d 203.0.113.10 -j ACCEPT"]
    }
  ]);
});

test("startContainer removes the container when firewall rules cannot be applied", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const commandRunner: CommandRunner = async (command, args) => {
    calls.push({ command, args });

    if (args[0] === "run") {
      return {
        stdout: "container-123\n",
        stderr: "",
        exitCode: 0
      };
    }

    if (args[0] === "exec") {
      return {
        stdout: "",
        stderr: "iptables: not found",
        exitCode: 1
      };
    }

    return {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
  };

  await assert.rejects(
    () =>
      startContainer(
        {
          agent_name: "risk-agent",
          image: "registry.example.com/agents/risk-agent:1.0.0",
          allowed_hosts: ["api.risk.com"],
          allowed_rpc_endpoints: ["https://rpc.edge.local"]
        },
        {
          commandRunner,
          hostPort: 18080,
          getDnsServers: async () => ["192.168.65.7"],
          resolveHost: async (host: string) => {
            if (host === "api.risk.com") {
              return ["203.0.113.10"];
            }

            if (host === "rpc.edge.local") {
              return ["198.51.100.7"];
            }

            throw new Error(`unexpected host: ${host}`);
          }
        }
      ),
    /Failed to apply firewall rules/
  );

  assert.deepEqual(calls.slice(-1), [{ command: "docker", args: ["rm", "-f", "container-123"] }]);
});

test("stopContainer and removeContainer invoke docker with the supplied container id", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const commandRunner: CommandRunner = async (command, args) => {
    calls.push({ command, args });
    return {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
  };

  await stopContainer("container-123", { commandRunner });
  await removeContainer("container-123", { commandRunner });

  assert.deepEqual(calls, [
    { command: "docker", args: ["stop", "container-123"] },
    { command: "docker", args: ["rm", "-f", "container-123"] }
  ]);
});

test("stopContainer, removeContainer, and killContainer ignore missing containers", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const commandRunner: CommandRunner = async (command, args) => {
    calls.push({ command, args });
    return {
      stdout: "",
      stderr: "Error response from daemon: No such container: container-123",
      exitCode: 1
    };
  };

  await stopContainer("container-123", { commandRunner });
  await removeContainer("container-123", { commandRunner });
  await killContainer("container-123", { commandRunner });

  assert.deepEqual(calls, [
    { command: "docker", args: ["stop", "container-123"] },
    { command: "docker", args: ["rm", "-f", "container-123"] },
    { command: "docker", args: ["kill", "container-123"] }
  ]);
});

test("killContainer invokes docker kill with the supplied container id", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const commandRunner: CommandRunner = async (command, args) => {
    calls.push({ command, args });
    return {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
  };

  await killContainer("container-123", { commandRunner });

  assert.deepEqual(calls, [{ command: "docker", args: ["kill", "container-123"] }]);
});

test("startContainer uses --network and --name instead of -p when networkName is set", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const commandRunner: CommandRunner = async (command, args) => {
    calls.push({ command, args });
    return {
      stdout: "container-net-123\n",
      stderr: "",
      exitCode: 0
    };
  };

  const started: StartedContainer = await startContainer(
    {
      agent_name: "risk-agent",
      image: "registry.example.com/agents/risk-agent:1.0.0",
      allowed_hosts: ["api.risk.com"],
      allowed_rpc_endpoints: ["https://rpc.edge.local"]
    },
    {
      commandRunner,
      networkName: "shenji-network",
      getDnsServers: async () => ["192.168.65.7"],
      resolveHost: async (host: string) => {
        if (host === "api.risk.com") {
          return ["203.0.113.10"];
        }

        if (host === "rpc.edge.local") {
          return ["198.51.100.7"];
        }

        throw new Error(`unexpected host: ${host}`);
      }
    }
  );

  assert.equal(started.containerId, "container-net-123");
  assert.equal(started.port, PORT);
  assert.match(started.host, /^shenji-audit-[0-9a-f]{8}$/);

  const runCall = calls[0];
  assert.ok(runCall);
  assert.equal(runCall.args[0], "run");
  assert.ok(runCall.args.includes("--network"), "should include --network flag");
  assert.ok(runCall.args.includes("shenji-network"), "should include network name");
  assert.ok(runCall.args.includes("--name"), "should include --name flag");
  assert.ok(!runCall.args.includes("-p"), "should not include -p flag in network mode");
});

test("startContainer returns host 127.0.0.1 with hostPort when networkName is not set", async () => {
  const commandRunner: CommandRunner = async () => ({
    stdout: "container-456\n",
    stderr: "",
    exitCode: 0
  });

  const started: StartedContainer = await startContainer(
    {
      agent_name: "risk-agent",
      image: "registry.example.com/agents/risk-agent:1.0.0",
      allowed_hosts: [],
      allowed_rpc_endpoints: []
    },
    {
      commandRunner,
      hostPort: 19090,
      getDnsServers: async () => ["192.168.65.7"],
      resolveHost: async () => []
    }
  );

  assert.equal(started.host, "127.0.0.1");
  assert.equal(started.port, 19090);
});
