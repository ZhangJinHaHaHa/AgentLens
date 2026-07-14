import { describe, expect, it } from "vitest";

import { validateAgentManifestInput } from "./manifestValidation";

describe("validateAgentManifestInput", () => {
  it("accepts explicit empty network allowlists", () => {
    const result = validateAgentManifestInput({
      agentName: "offline-agent",
      image: "registry.example.com/offline-agent:1.0.0",
      allowedHosts: "",
      allowedRpcEndpoints: "",
      manifestUrl: "https://example.com/offline-manifest.json"
    });
    expect(result.ok).toBe(true);
    expect(result.manifest.allowed_hosts).toEqual([]);
    expect(result.manifest.allowed_rpc_endpoints).toEqual([]);
  });

  it("still rejects private network targets", () => {
    const result = validateAgentManifestInput({
      agentName: "private-agent",
      image: "registry.example.com/private-agent:1.0.0",
      allowedHosts: "localhost",
      allowedRpcEndpoints: "http://127.0.0.1:8545",
      manifestUrl: "https://example.com/manifest.json"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("allowedHostsPrivate");
      expect(result.errors).toContain("rpcPrivate");
    }
  });
});
