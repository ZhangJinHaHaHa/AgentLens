import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { StartedContainer } from "../../src/docker/dockerRunner";
import type { HealthcheckOptions } from "../../src/docker/healthcheck";
import type { EgressProbeResult } from "../../src/network/egressProbe";
import { runEgressAcceptanceCheck } from "../../src/runtime/runEgressAcceptanceCheck";
import type { SandboxManifest } from "../../src/types/manifest";

async function writeManifestFile(content: SandboxManifest): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "sandbox-acceptance-"));
  const filePath = path.join(dir, "manifest.json");
  await writeFile(filePath, JSON.stringify(content), "utf8");
  return filePath;
}

test("runEgressAcceptanceCheck returns accepted when allowed target is reachable and blocked target is denied", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });
  const operations: string[] = [];

  const result = await runEgressAcceptanceCheck({
    manifestPath,
    allowedEgressTargetUrl: "https://api.risk.com",
    blockedEgressTargetUrl: "https://malicious.example",
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
    probeEgress: async (_containerId: string, targetUrl: string): Promise<EgressProbeResult> => {
      operations.push(`probe:${targetUrl}`);
      return targetUrl === "https://api.risk.com"
        ? { reachable: true, toolAvailable: true }
        : { reachable: false, toolAvailable: true };
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
    "health:127.0.0.1:8080",
    "probe:https://api.risk.com",
    "probe:https://malicious.example",
    "stop:container-123",
    "remove:container-123"
  ]);

  assert.deepEqual(result, {
    manifestValid: true,
    dockerAvailable: true,
    serverVersion: "28.0.4",
    healthcheckPassed: true,
    firewallConfigured: true,
    allowedEgressTargetUrl: "https://api.risk.com",
    allowedEgressReachable: true,
    allowedEgressProbeAvailable: true,
    blockedEgressTargetUrl: "https://malicious.example",
    undeclaredEgressBlocked: true,
    blockedEgressProbeAvailable: true,
    accepted: true
  });
});

test("runEgressAcceptanceCheck returns accepted false when the blocked target is still reachable", async () => {
  const manifestPath = await writeManifestFile({
    agent_name: "risk-agent",
    image: "registry.example.com/agents/risk-agent:1.0.0",
    allowed_hosts: ["api.risk.com"],
    allowed_rpc_endpoints: ["https://rpc.edge.local"]
  });

  const result = await runEgressAcceptanceCheck({
    manifestPath,
    allowedEgressTargetUrl: "https://api.risk.com",
    blockedEgressTargetUrl: "https://malicious.example",
    checkDockerAvailability: async () => ({
      available: true,
      serverVersion: "28.0.4"
    }),
    pullImage: async () => {},
    startContainer: async (): Promise<StartedContainer> => ({
      containerId: "container-456",
      host: "127.0.0.1",
      port: 8080
    }),
    waitForHealth: async () => {},
    verifyFirewallRules: async () => ({
      configured: true,
      missingRules: []
    }),
    probeEgress: async () => ({
      reachable: true,
      toolAvailable: true
    }),
    stopContainer: async () => {},
    removeContainer: async () => {}
  });

  assert.equal(result.accepted, false);
  assert.equal(result.allowedEgressReachable, true);
  assert.equal(result.undeclaredEgressBlocked, false);
});
