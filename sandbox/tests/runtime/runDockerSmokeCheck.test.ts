import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { StartedContainer } from "../../src/docker/dockerRunner";
import { runDockerSmokeCheck } from "../../src/runtime/runDockerSmokeCheck";
import { AgentUnavailableError, type HealthcheckOptions } from "../../src/docker/healthcheck";
import type { SandboxManifest } from "../../src/types/manifest";

async function writeManifestFile(content: SandboxManifest): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "sandbox-smoke-"));
  const filePath = path.join(dir, "manifest.json");
  await writeFile(filePath, JSON.stringify(content), "utf8");
  return filePath;
}

test("runDockerSmokeCheck returns unavailable when docker daemon cannot be reached", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  const result = await runDockerSmokeCheck({
    manifestPath,
    checkDockerAvailability: async () => ({
      available: false,
      reason: "DOCKER_UNAVAILABLE",
      detail: "Cannot connect to daemon"
    })
  });

  assert.equal(result.manifestValid, true);
  assert.equal(result.dockerAvailable, false);
  assert.equal(result.reasonCode, "DOCKER_UNAVAILABLE");
});

test("runDockerSmokeCheck accepts a manifest URL before checking docker availability", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request) => {
    assert.equal(String(input), "https://manifests.example/manifest.json");
    return new Response(
      JSON.stringify({
        agent_name: "risk-agent",
        image: "registry.example.com/agents/risk-agent:1.0.0",
        allowed_hosts: ["api.risk.com"],
        allowed_rpc_endpoints: ["https://rpc.edge.local"]
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" }
      }
    );
  };

  try {
    const result = await runDockerSmokeCheck({
      manifestPath: "https://manifests.example/manifest.json",
      checkDockerAvailability: async () => ({
        available: false,
        reason: "DOCKER_UNAVAILABLE",
        detail: "Cannot connect to daemon"
      })
    });

    assert.equal(result.manifestValid, true);
    assert.equal(result.dockerAvailable, false);
    assert.equal(result.reasonCode, "DOCKER_UNAVAILABLE");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runDockerSmokeCheck runs pull, start, healthcheck, and cleanup when docker is available", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });
  const operations: string[] = [];

  const result = await runDockerSmokeCheck({
    manifestPath,
    checkDockerAvailability: async () => ({
      available: true,
      serverVersion: "28.0.4"
    }),
    pullImage: async (manifest: SandboxManifest) => {
      operations.push(`pull:${manifest.image}`);
    },
    startContainer: async (manifest: SandboxManifest): Promise<StartedContainer> => {
      operations.push(`start:${manifest.agent_name}`);
      return {
        containerId: "container-123",
        host: "127.0.0.1",
        port: 8080
      };
    },
    waitForHealth: async ({ host, port }: HealthcheckOptions) => {
      operations.push(`health:${host}:${port}`);
    },
    verifyFirewallRules: async () => ({
      configured: true,
      missingRules: []
    }),
    stopContainer: async (containerId: string) => {
      operations.push(`stop:${containerId}`);
    },
    removeContainer: async (containerId: string) => {
      operations.push(`remove:${containerId}`);
    }
  });

  assert.deepEqual(operations, [
    "pull:registry.example.com/agents/risk-agent:1.0.0",
    "start:risk-agent",
    "health:127.0.0.1:8080",
    "stop:container-123",
    "remove:container-123"
  ]);

  assert.deepEqual(result, {
    manifestValid: true,
    dockerAvailable: true,
    serverVersion: "28.0.4",
    imagePulled: true,
    containerStarted: true,
    firewallConfigured: true,
    healthcheckPassed: true,
    nextStep: "READY_FOR_LOCAL_AUDIT"
  });
});

test("runDockerSmokeCheck includes undeclared egress probe results when a blocked target is supplied", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  const result = await runDockerSmokeCheck({
    manifestPath,
    blockedEgressTargetUrl: "https://malicious.example",
    checkDockerAvailability: async () => ({
      available: true,
      serverVersion: "28.0.4"
    }),
    pullImage: async () => {},
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-321",
      host: "127.0.0.1",
      port: 8080
    }),
    verifyFirewallRules: async () => ({
      configured: true,
      missingRules: []
    }),
    probeEgress: async () => ({
      reachable: false,
      toolAvailable: true
    }),
    waitForHealth: async () => {},
    stopContainer: async () => {},
    removeContainer: async () => {}
  });

  assert.deepEqual(result, {
    manifestValid: true,
    dockerAvailable: true,
    serverVersion: "28.0.4",
    imagePulled: true,
    containerStarted: true,
    firewallConfigured: true,
    blockedEgressTargetUrl: "https://malicious.example",
    undeclaredEgressBlocked: true,
    egressProbeAvailable: true,
    healthcheckPassed: true,
    nextStep: "READY_FOR_LOCAL_AUDIT"
  });
});

test("runDockerSmokeCheck returns AGENT_UNAVAILABLE and still cleans up when healthcheck fails", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });
  const operations: string[] = [];

  const result = await runDockerSmokeCheck({
    manifestPath,
    checkDockerAvailability: async () => ({
      available: true,
      serverVersion: "28.0.4"
    }),
    pullImage: async () => {
      operations.push("pull");
    },
    startContainer: async (): Promise<StartedContainer> => {
      operations.push("start");
      return {
        containerId: "container-456",
        host: "127.0.0.1",
        port: 8080
      };
    },
    verifyFirewallRules: async () => ({
      configured: true,
      missingRules: []
    }),
    waitForHealth: async () => {
      operations.push("health");
      throw new AgentUnavailableError("container did not become healthy");
    },
    stopContainer: async (containerId: string) => {
      operations.push(`stop:${containerId}`);
    },
    removeContainer: async (containerId: string) => {
      operations.push(`remove:${containerId}`);
    }
  });

  assert.deepEqual(operations, [
    "pull",
    "start",
    "health",
    "stop:container-456",
    "remove:container-456"
  ]);

  assert.deepEqual(result, {
    manifestValid: true,
    dockerAvailable: true,
    serverVersion: "28.0.4",
    imagePulled: true,
    containerStarted: true,
    firewallConfigured: true,
    healthcheckPassed: false,
    reasonCode: "AGENT_UNAVAILABLE",
    detail: "container did not become healthy"
  });
});

test("runDockerSmokeCheck reports firewallConfigured false when expected rules are missing", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  const result = await runDockerSmokeCheck({
    manifestPath,
    checkDockerAvailability: async () => ({
      available: true,
      serverVersion: "28.0.4"
    }),
    pullImage: async () => {},
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-789",
      host: "127.0.0.1",
      port: 8080
    }),
    verifyFirewallRules: async () => ({
      configured: false,
      missingRules: ["-A OUTPUT -d api.risk.com -j ACCEPT"]
    }),
    waitForHealth: async () => {},
    stopContainer: async () => {},
    removeContainer: async () => {}
  });

  assert.deepEqual(result, {
    manifestValid: true,
    dockerAvailable: true,
    serverVersion: "28.0.4",
    imagePulled: true,
    containerStarted: true,
    firewallConfigured: false,
    healthcheckPassed: true,
    nextStep: "READY_FOR_LOCAL_AUDIT"
  });
});
