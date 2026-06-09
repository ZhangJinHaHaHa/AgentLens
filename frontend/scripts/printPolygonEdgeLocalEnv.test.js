import { describe, expect, it } from "vitest";

import {
  buildDeploymentPathCandidates,
  formatPolygonEdgeLocalEnv,
  resolveDeploymentPathArg,
  writePolygonEdgeLocalEnvFile
} from "./printPolygonEdgeLocalEnv.js";

describe("formatPolygonEdgeLocalEnv", () => {
  it("formats the frontend VITE variables from deployment metadata", () => {
    expect(
      formatPolygonEdgeLocalEnv({
        rpcUrl: "http://127.0.0.1:18545",
        address: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
        chainId: "302512"
      }, {})
    ).toBe(
      [
        "VITE_AUDIT_RPC_URL=http://127.0.0.1:18545",
        "VITE_AUDIT_REGISTRY_ADDRESS=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
        "VITE_AUDIT_CHAIN_ID=302512"
      ].join("\n")
    );
  });

  it("includes an optional report gateway variable when one is provided", () => {
    expect(
      formatPolygonEdgeLocalEnv(
        {
          rpcUrl: "http://127.0.0.1:18545",
          address: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
          chainId: "302512"
        },
        {
          VITE_AUDIT_REPORT_GATEWAY_URL: "http://127.0.0.1:3101/reports/"
        }
      )
    ).toBe(
      [
        "VITE_AUDIT_RPC_URL=http://127.0.0.1:18545",
        "VITE_AUDIT_REGISTRY_ADDRESS=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
        "VITE_AUDIT_CHAIN_ID=302512",
        "VITE_AUDIT_REPORT_GATEWAY_URL=http://127.0.0.1:3101/reports/"
      ].join("\n")
    );
  });

  it("includes the primary repo deployment path when running from a .worktrees checkout", () => {
    expect(
      buildDeploymentPathCandidates(
        "/Users/demo/agent-shenji/.worktrees/exec-local-baseline-a/frontend/scripts/printPolygonEdgeLocalEnv.js"
      )
    ).toEqual([
      "/Users/demo/agent-shenji/.worktrees/exec-local-baseline-a/contracts/deployments/polygon-edge-local/AgentAuditRegistry.json",
      "/Users/demo/agent-shenji/contracts/deployments/polygon-edge-local/AgentAuditRegistry.json"
    ]);
  });

  it("writes frontend/.env.local with the formatted local Polygon Edge values", () => {
    const writes = [];
    const fsDouble = {
      writeFileSync(filePath, content) {
        writes.push({ filePath, content });
      }
    };

    const outputPath = writePolygonEdgeLocalEnvFile(
      {
        rpcUrl: "http://127.0.0.1:18545",
        address: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
        chainId: "302512"
      },
      fsDouble,
      "/Users/demo/agent-shenji/frontend",
      {}
    );

    expect(outputPath).toBe("/Users/demo/agent-shenji/frontend/.env.local");
    expect(writes).toEqual([
      {
        filePath: "/Users/demo/agent-shenji/frontend/.env.local",
        content: [
          "VITE_AUDIT_RPC_URL=http://127.0.0.1:18545",
          "VITE_AUDIT_REGISTRY_ADDRESS=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
          "VITE_AUDIT_CHAIN_ID=302512",
          ""
        ].join("\n")
      }
    ]);
  });

  it("ignores CLI flags when resolving an optional deployment path argument", () => {
    expect(resolveDeploymentPathArg(["node", "script.js", "--write"])).toBe(undefined);
    expect(resolveDeploymentPathArg(["node", "script.js", "custom/deployment.json", "--write"])).toBe(
      "custom/deployment.json"
    );
  });
});
