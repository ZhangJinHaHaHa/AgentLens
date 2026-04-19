import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { AgentUnavailableError } from "../../src/docker/healthcheck";
import { runLocalSandboxAudit } from "../../src/runtime/runLocalSandboxAudit";
import { DEFAULT_CPU, DEFAULT_MEMORY_MB } from "../../src/config/constants";
import type { AuditSolveRequest, AuditSolveResponse, SandboxManifest } from "../../src/types/manifest";
import type { StartedContainer } from "../../src/docker/dockerRunner";

async function writeManifestFile(content: SandboxManifest): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "sandbox-runtime-"));
  const filePath = path.join(dir, "manifest.json");
  await writeFile(filePath, JSON.stringify(content), "utf8");
  return filePath;
}

async function runCompletedAuditWithAnswer(answer: string) {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  return runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async () => {},
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-123",
      host: "127.0.0.1",
      port: 18080
    }),
    waitForHealth: async () => {},
    sendAuditRequest: async (): Promise<AuditSolveResponse> => ({
      answer,
      actions: [{ type: "web_request", url: "https://api.risk.com/v1/alert" }]
    }),
    collectResourceUsage: async () => ({
      cpuAvgMilli: 123,
      memoryPeakMb: 256
    }),
    collectNetworkActivity: async () => ({
      requestedIps: ["203.0.113.10"],
      requestedHosts: [],
      requestCount: 1
    }),
    killContainer: async () => {},
    stopContainer: async () => {},
    removeContainer: async () => {}
  });
}

test("runLocalSandboxAudit orchestrates manifest loading, healthcheck and solve into a minimal result", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });
  const calls: string[] = [];

  const result = await runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async (manifest) => {
      calls.push(`pull:${manifest.image}`);
    },
    startContainer: async (manifest: SandboxManifest): Promise<StartedContainer> => {
      calls.push(`start:${manifest.agent_name}`);
      return {
        containerId: "container-123",
        host: "127.0.0.1",
        port: 18080
      };
    },
    waitForHealth: async () => {
      calls.push("health");
    },
    sendAuditRequest: async (options: {
      host: string;
      port: number;
      request: AuditSolveRequest;
      timeoutMs: number;
    }): Promise<AuditSolveResponse> => {
      calls.push(`solve:${options.request.task_id}`);
      return {
        answer: "safe result",
        actions: [{ type: "web_request", url: "https://api.risk.com/v1/alert" }]
      };
    },
    collectResourceUsage: async () => ({
      cpuAvgMilli: 123,
      memoryPeakMb: 256
    }),
    collectNetworkActivity: async () => ({
      requestedIps: ["203.0.113.10"],
      requestedHosts: [],
      requestCount: 1,
      networkEvidence: {
        source: "procfs",
        observedAt: "2026-03-28T10:00:06.000Z",
        connections: [
          {
            protocol: "tcp4",
            remoteIp: "203.0.113.10",
            remotePort: 443,
            state: "ESTABLISHED"
          }
        ]
      }
    }),
    killContainer: async (containerId: string) => {
      calls.push(`kill:${containerId}`);
    },
    stopContainer: async (containerId: string) => {
      calls.push(`stop:${containerId}`);
    },
    removeContainer: async (containerId: string) => {
      calls.push(`remove:${containerId}`);
    }
  });

  assert.equal(result.agentName, "risk-agent");
  assert.equal(result.healthcheckPassed, true);
  assert.equal(result.answer, "safe result");
  assert.deepEqual(result.actions, [{ type: "web_request", url: "https://api.risk.com/v1/alert" }]);
  assert.equal(result.cpuAvgMilli, 123);
  assert.equal(result.memoryPeakMb, 256);
  assert.deepEqual(result.requestedIps, ["203.0.113.10"]);
  assert.deepEqual(result.requestedHosts, []);
  assert.equal(result.requestCount, 1);
  assert.deepEqual(result.networkEvidence, {
    source: "procfs",
    observedAt: "2026-03-28T10:00:06.000Z",
    connections: [
      {
        protocol: "tcp4",
        remoteIp: "203.0.113.10",
        remotePort: 443,
        state: "ESTABLISHED"
      }
    ]
  });
  assert.equal(result.actionReconciliation?.reasonCode, undefined);
  assert.deepEqual(result.actionReconciliation, {
    declaredHosts: ["api.risk.com"],
    observedHosts: [],
    undeclaredObservedHosts: [],
    declaredUnobservedHosts: ["api.risk.com"]
  });
  assert.equal(result.decisionType, "undetermined");
  assert.equal(result.status, "completed");
  assert.equal(typeof result.manifestHash, "string");
  assert.deepEqual(calls, [
    "pull:registry.example.com/agents/risk-agent:1.0.0",
    "start:risk-agent",
    "health",
    "solve:task-123",
    "stop:container-123",
    "remove:container-123"
  ]);
});

test("runLocalSandboxAudit emits streaming evidence for the main execution stages", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });
  const stages: string[] = [];

  await runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async () => {},
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-123",
      host: "127.0.0.1",
      port: 18080
    }),
    waitForHealth: async () => {},
    sendAuditRequest: async (): Promise<AuditSolveResponse> => ({
      answer: "safe result",
      actions: []
    }),
    collectResourceUsage: async () => ({
      cpuAvgMilli: 123,
      memoryPeakMb: 256
    }),
    collectNetworkActivity: async () => ({
      requestedIps: [],
      requestedHosts: [],
      requestCount: 0
    }),
    emitEvidence: async (event) => {
      stages.push(event.stage);
    },
    killContainer: async () => {},
    stopContainer: async () => {},
    removeContainer: async () => {}
  });

  assert.deepEqual(stages, [
    "container_started",
    "healthcheck_passed",
    "audit_request_sent",
    "audit_response_received",
    "resource_usage_collected",
    "network_activity_collected"
  ]);
});

test("runLocalSandboxAudit keeps completed status while answer marks a redline violation", async () => {
  const result = await runCompletedAuditWithAnswer("Summary...\nDECISION: redline_violation");

  assert.equal(result.status, "completed");
  assert.equal(result.reasonCode, undefined);
  assert.equal(result.decisionType, "redline_violation");
});

test("runLocalSandboxAudit keeps completed status while answer marks an ordinary failure", async () => {
  const result = await runCompletedAuditWithAnswer("Summary...\nDECISION: ordinary_failure");

  assert.equal(result.status, "completed");
  assert.equal(result.reasonCode, undefined);
  assert.equal(result.decisionType, "ordinary_failure");
});

test("runLocalSandboxAudit stops and removes the container when solve fails", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });
  const calls: string[] = [];

  await assert.rejects(
    () =>
      runLocalSandboxAudit({
        manifestPath,
        request: {
          task_id: "task-123",
          question: "question",
          context: { history: [] },
          constraints: { response_format: "json" }
        },
        pullImage: async () => {
          calls.push("pull");
        },
        startContainer: async (): Promise<StartedContainer> => ({
          containerId: "container-123",
          host: "127.0.0.1",
          port: 18080
        }),
        waitForHealth: async () => {
          calls.push("health");
        },
        sendAuditRequest: async (_options: {
          request: AuditSolveRequest;
        }): Promise<AuditSolveResponse> => {
          throw new Error("boom");
        },
        collectResourceUsage: async () => ({
          cpuAvgMilli: 0,
          memoryPeakMb: 0
        }),
        collectNetworkActivity: async () => ({
          requestedIps: [],
          requestedHosts: [],
          requestCount: 0
        }),
        killContainer: async (containerId: string) => {
          calls.push(`kill:${containerId}`);
        },
        stopContainer: async (containerId: string) => {
          calls.push(`stop:${containerId}`);
        },
        removeContainer: async (containerId: string) => {
          calls.push(`remove:${containerId}`);
        }
      }),
    /boom/
  );

  assert.deepEqual(calls, ["pull", "health", "stop:container-123", "remove:container-123"]);
});

test("runLocalSandboxAudit returns timeout status and reasonCode when solve times out", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });
  const calls: string[] = [];

  const result = await runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async () => {
      calls.push("pull");
    },
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-123",
      host: "127.0.0.1",
      port: 18080
    }),
    waitForHealth: async () => {
      calls.push("health");
    },
    sendAuditRequest: async () => {
      const error = new Error("request timed out");
      (error as Error & { reasonCode?: string }).reasonCode = "REQUEST_TIMEOUT";
      throw error;
    },
    collectResourceUsage: async () => ({
      cpuAvgMilli: 0,
      memoryPeakMb: 0
    }),
    collectNetworkActivity: async () => ({
      requestedIps: [],
      requestedHosts: [],
      requestCount: 0
    }),
    killContainer: async (containerId: string) => {
      calls.push(`kill:${containerId}`);
    },
    stopContainer: async (containerId: string) => {
      calls.push(`stop:${containerId}`);
    },
    removeContainer: async (containerId: string) => {
      calls.push(`remove:${containerId}`);
    }
  });

  assert.equal(result.status, "failed");
  assert.equal(result.decisionType, "ordinary_failure");
  assert.equal(result.reasonCode, "REQUEST_TIMEOUT");
  assert.equal(result.healthcheckPassed, true);
  assert.deepEqual(result.actions, []);
  assert.equal(result.answer, "");
  assert.deepEqual(result.requestedHosts, []);
  assert.deepEqual(calls, ["pull", "health", "kill:container-123", "stop:container-123", "remove:container-123"]);
});

test("runLocalSandboxAudit returns failed result when healthcheck does not become ready", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });
  const calls: string[] = [];

  const result = await runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async () => {
      calls.push("pull");
    },
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-123",
      host: "127.0.0.1",
      port: 18080
    }),
    waitForHealth: async () => {
      calls.push("health");
      throw new AgentUnavailableError("healthcheck timeout");
    },
    sendAuditRequest: async (): Promise<AuditSolveResponse> => {
      calls.push("solve");
      return {
        answer: "safe result",
        actions: []
      };
    },
    collectResourceUsage: async () => ({
      cpuAvgMilli: 0,
      memoryPeakMb: 0
    }),
    collectNetworkActivity: async () => ({
      requestedIps: [],
      requestedHosts: [],
      requestCount: 0
    }),
    killContainer: async (containerId: string) => {
      calls.push(`kill:${containerId}`);
    },
    stopContainer: async (containerId: string) => {
      calls.push(`stop:${containerId}`);
    },
    removeContainer: async (containerId: string) => {
      calls.push(`remove:${containerId}`);
    }
  });

  assert.equal(result.status, "failed");
  assert.equal(result.decisionType, "ordinary_failure");
  assert.equal(result.reasonCode, "AGENT_UNAVAILABLE");
  assert.equal(result.healthcheckPassed, false);
  assert.equal(result.answer, "");
  assert.deepEqual(result.actions, []);
  assert.deepEqual(result.requestedHosts, []);
  assert.deepEqual(calls, ["pull", "health", "stop:container-123", "remove:container-123"]);
});

test("runLocalSandboxAudit returns failed result when docker image pull cannot reach the daemon", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });
  const calls: string[] = [];

  const result = await runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async () => {
      calls.push("pull");
      throw new Error("Failed to pull image: Cannot connect to the Docker daemon at unix:///var/run/docker.sock");
    },
    startContainer: async (): Promise<StartedContainer> => {
      calls.push("start");
      return {
        containerId: "container-123",
        host: "127.0.0.1",
        port: 18080
      };
    },
    waitForHealth: async () => {
      calls.push("health");
    },
    sendAuditRequest: async (): Promise<AuditSolveResponse> => ({
      answer: "safe result",
      actions: []
    }),
    collectResourceUsage: async () => ({
      cpuAvgMilli: 0,
      memoryPeakMb: 0
    }),
    collectNetworkActivity: async () => ({
      requestedIps: [],
      requestedHosts: [],
      requestCount: 0
    }),
    killContainer: async (containerId: string) => {
      calls.push(`kill:${containerId}`);
    },
    stopContainer: async (containerId: string) => {
      calls.push(`stop:${containerId}`);
    },
    removeContainer: async (containerId: string) => {
      calls.push(`remove:${containerId}`);
    }
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reasonCode, "DOCKER_UNAVAILABLE");
  assert.equal(result.healthcheckPassed, false);
  assert.equal(result.answer, "");
  assert.deepEqual(result.actions, []);
  assert.deepEqual(calls, ["pull"]);
});

test("runLocalSandboxAudit returns failed result when the container cannot start", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });
  const calls: string[] = [];

  const result = await runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async () => {
      calls.push("pull");
    },
    startContainer: async (): Promise<StartedContainer> => {
      calls.push("start");
      throw new Error("Failed to start container: port already allocated");
    },
    waitForHealth: async () => {
      calls.push("health");
    },
    sendAuditRequest: async (): Promise<AuditSolveResponse> => ({
      answer: "safe result",
      actions: []
    }),
    collectResourceUsage: async () => ({
      cpuAvgMilli: 0,
      memoryPeakMb: 0
    }),
    collectNetworkActivity: async () => ({
      requestedIps: [],
      requestedHosts: [],
      requestCount: 0
    }),
    killContainer: async (containerId: string) => {
      calls.push(`kill:${containerId}`);
    },
    stopContainer: async (containerId: string) => {
      calls.push(`stop:${containerId}`);
    },
    removeContainer: async (containerId: string) => {
      calls.push(`remove:${containerId}`);
    }
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reasonCode, "CONTAINER_START_FAILED");
  assert.equal(result.healthcheckPassed, false);
  assert.equal(result.answer, "");
  assert.deepEqual(result.actions, []);
  assert.deepEqual(calls, ["pull", "start"]);
});

test("runLocalSandboxAudit returns failed result when memory exceeds the sandbox limit", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  const result = await runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async () => {},
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-123",
      host: "127.0.0.1",
      port: 18080
    }),
    waitForHealth: async () => {},
    sendAuditRequest: async (): Promise<AuditSolveResponse> => ({
      answer: "safe result",
      actions: []
    }),
    collectResourceUsage: async () => ({
      cpuAvgMilli: 100,
      memoryPeakMb: DEFAULT_MEMORY_MB + 1
    }),
    collectNetworkActivity: async () => ({
      requestedIps: [],
      requestedHosts: [],
      requestCount: 0
    }),
    killContainer: async () => {},
    stopContainer: async () => {},
    removeContainer: async () => {}
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reasonCode, "MEMORY_LIMIT_EXCEEDED");
  assert.equal(result.memoryPeakMb, DEFAULT_MEMORY_MB + 1);
});

test("runLocalSandboxAudit returns failed result when cpu exceeds the sandbox limit", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  const result = await runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async () => {},
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-123",
      host: "127.0.0.1",
      port: 18080
    }),
    waitForHealth: async () => {},
    sendAuditRequest: async (): Promise<AuditSolveResponse> => ({
      answer: "safe result",
      actions: []
    }),
    collectResourceUsage: async () => ({
      cpuAvgMilli: DEFAULT_CPU * 1000 + 1,
      memoryPeakMb: DEFAULT_MEMORY_MB
    }),
    collectNetworkActivity: async () => ({
      requestedIps: [],
      requestedHosts: [],
      requestCount: 0
    }),
    killContainer: async () => {},
    stopContainer: async () => {},
    removeContainer: async () => {}
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reasonCode, "CPU_LIMIT_EXCEEDED");
  assert.equal(result.cpuAvgMilli, DEFAULT_CPU * 1000 + 1);
});

test("runLocalSandboxAudit returns failed result when observed hosts are outside the manifest allowlist", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  const result = await runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async () => {},
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-123",
      host: "127.0.0.1",
      port: 18080
    }),
    waitForHealth: async () => {},
    sendAuditRequest: async (): Promise<AuditSolveResponse> => ({
      answer: "safe result",
      actions: []
    }),
    collectResourceUsage: async () => ({
      cpuAvgMilli: 100,
      memoryPeakMb: DEFAULT_MEMORY_MB
    }),
    collectNetworkActivity: async () => ({
      requestedIps: ["203.0.113.10"],
      requestedHosts: ["malicious.example"],
      requestCount: 1
    }),
    killContainer: async () => {},
    stopContainer: async () => {},
    removeContainer: async () => {}
  });

  assert.equal(result.status, "failed");
  assert.equal(result.decisionType, "redline_violation");
  assert.equal(result.reasonCode, "UNDECLARED_EGRESS");
  assert.deepEqual(result.requestedHosts, ["malicious.example"]);
});

test("runLocalSandboxAudit returns failed result when observed hosts do not match declared actions", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com", "rpc.edge.local"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  const result = await runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async () => {},
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-123",
      host: "127.0.0.1",
      port: 18080
    }),
    waitForHealth: async () => {},
    sendAuditRequest: async (): Promise<AuditSolveResponse> => ({
      answer: "safe result",
      actions: [
        {
          type: "web_request",
          url: "https://api.risk.com/v1/alert"
        }
      ]
    }),
    collectResourceUsage: async () => ({
      cpuAvgMilli: 100,
      memoryPeakMb: DEFAULT_MEMORY_MB
    }),
    collectNetworkActivity: async () => ({
      requestedIps: ["203.0.113.10", "203.0.113.11"],
      requestedHosts: ["api.risk.com", "rpc.edge.local"],
      requestCount: 2
    }),
    killContainer: async () => {},
    stopContainer: async () => {},
    removeContainer: async () => {}
  });

  assert.equal(result.status, "failed");
  assert.equal(result.decisionType, "redline_violation");
  assert.equal(result.reasonCode, "ACTION_MISMATCH");
});

test("runLocalSandboxAudit does not fail on declared web_request hosts when host observation is unavailable", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  const result = await runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async () => {},
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-123",
      host: "127.0.0.1",
      port: 18080
    }),
    waitForHealth: async () => {},
    sendAuditRequest: async (): Promise<AuditSolveResponse> => ({
      answer: "safe result",
      actions: [
        {
          type: "web_request",
          url: "https://api.risk.com/v1/alert"
        }
      ]
    }),
    collectResourceUsage: async () => ({
      cpuAvgMilli: 100,
      memoryPeakMb: DEFAULT_MEMORY_MB
    }),
    collectNetworkActivity: async () => ({
      requestedIps: [],
      requestedHosts: [],
      requestCount: 0
    }),
    killContainer: async () => {},
    stopContainer: async () => {},
    removeContainer: async () => {}
  });

  assert.equal(result.status, "completed");
  assert.equal(result.reasonCode, undefined);
  assert.equal(result.actionReconciliation?.reasonCode, undefined);
  assert.deepEqual(result.actionReconciliation, {
    declaredHosts: ["api.risk.com"],
    observedHosts: [],
    undeclaredObservedHosts: [],
    declaredUnobservedHosts: ["api.risk.com"]
  });
});

test("runLocalSandboxAudit returns failed result when declared hosts are unobserved and host observation is available", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com", "rpc.edge.local"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  const result = await runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async () => {},
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-123",
      host: "127.0.0.1",
      port: 18080
    }),
    waitForHealth: async () => {},
    sendAuditRequest: async (): Promise<AuditSolveResponse> => ({
      answer: "safe result",
      actions: [
        {
          type: "web_request",
          url: "https://api.risk.com/v1/alert"
        }
      ]
    }),
    collectResourceUsage: async () => ({
      cpuAvgMilli: 100,
      memoryPeakMb: DEFAULT_MEMORY_MB
    }),
    collectNetworkActivity: async () => ({
      requestedIps: ["203.0.113.10"],
      requestedHosts: ["rpc.edge.local"],
      requestCount: 1
    }),
    killContainer: async () => {},
    stopContainer: async () => {},
    removeContainer: async () => {}
  });

  assert.equal(result.status, "failed");
  assert.equal(result.reasonCode, "ACTION_MISMATCH");
});

test("runLocalSandboxAudit keeps policy failure ahead of action mismatch", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  const result = await runLocalSandboxAudit({
    manifestPath,
    request: {
      task_id: "task-123",
      question: "question",
      context: { history: [] },
      constraints: { response_format: "json" }
    },
    pullImage: async () => {},
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-123",
      host: "127.0.0.1",
      port: 18080
    }),
    waitForHealth: async () => {},
    sendAuditRequest: async (): Promise<AuditSolveResponse> => ({
      answer: "safe result",
      actions: [
        {
          type: "web_request",
          url: "https://api.risk.com/v1/alert"
        }
      ]
    }),
    collectResourceUsage: async () => ({
      cpuAvgMilli: 100,
      memoryPeakMb: DEFAULT_MEMORY_MB
    }),
    collectNetworkActivity: async () => ({
      requestedIps: ["203.0.113.10"],
      requestedHosts: ["malicious.example"],
      requestCount: 1
    }),
    killContainer: async () => {},
    stopContainer: async () => {},
    removeContainer: async () => {}
  });

  assert.equal(result.reasonCode, "UNDECLARED_EGRESS");
  assert.equal(result.status, "failed");
});
