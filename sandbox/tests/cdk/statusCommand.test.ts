import test from "node:test";
import assert from "node:assert/strict";

import { getCdkV2Interface } from "../../src/cdk/chain/cdkArtifact";
import { runStatusCommand } from "../../src/cdk/commands/statusCommand";

const iface = getCdkV2Interface();

function buildMockFetch(profileData: unknown[], reportData: unknown[]): typeof fetch {
  let callCount = 0;

  return (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };

    let result: string;
    if (body.method === "eth_call") {
      callCount++;
      if (callCount === 1) {
        result = iface.encodeFunctionResult("getAgentProfile", [profileData]);
      } else {
        result = iface.encodeFunctionResult("getLatestAuditReport", [reportData]);
      }
    } else {
      throw new Error(`Unexpected RPC method: ${body.method}`);
    }

    return {
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result })
    } as Response;
  }) as typeof fetch;
}

test("runStatusCommand prints agent profile and report", async () => {
  const fetchImpl = buildMockFetch(
    [
      "0x000000000000000000000000000000000000dEaD",
      "demo-agent",
      1,
      "1000000000000000000",
      false,
      1700000000,
      1700001000,
      2
    ],
    [
      1,
      1700001000,
      92,
      128,
      50,
      2,
      1,
      "0x" + "aa".repeat(32),
      "0x" + "bb".repeat(32),
      "0x" + "00".repeat(32),
      "0x" + "00".repeat(32),
      "",
      "QmReport",
      "https://example.com/manifest.json",
      false,
      false,
      [85, 90, 80, 75, 88, 92]
    ]
  );

  await runStatusCommand({
    tokenId: "1",
    watch: false,
    fetchImpl
  });
});

test("runStatusCommand handles pending agent with no report", async () => {
  const fetchImpl = buildMockFetch(
    [
      "0x000000000000000000000000000000000000dEaD",
      "new-agent",
      2,
      "500000000000000000",
      false,
      1700000000,
      0,
      0
    ],
    [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      "0x" + "00".repeat(32),
      "0x" + "00".repeat(32),
      "0x" + "00".repeat(32),
      "0x" + "00".repeat(32),
      "",
      "",
      "",
      false,
      false,
      [0, 0, 0, 0, 0, 0]
    ]
  );

  await runStatusCommand({
    tokenId: "2",
    watch: false,
    fetchImpl
  });
});
