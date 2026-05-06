import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { getCdkV2Interface } from "../../src/cdk/chain/cdkArtifact";
import { runRegisterCommand } from "../../src/cdk/commands/registerCommand";
import type { JsonRpcWriteClient, TransactionReceiptResult } from "../../src/chain/jsonRpcWriteClient";

const iface = getCdkV2Interface();

function makeDevNull(): Writable {
  return new Writable({ write(_chunk, _encoding, callback) { callback(); } });
}

function makeFetchForFees(serviceFee: string, minimumBond: string): typeof fetch {
  let callIndex = 0;
  return (async () => {
    callIndex++;
    let result: string;
    if (callIndex === 1) {
      result = iface.encodeFunctionResult("serviceFee", [serviceFee]);
    } else {
      result = iface.encodeFunctionResult("minimumBond", [minimumBond]);
    }
    return {
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result })
    } as Response;
  }) as typeof fetch;
}

function makeWriteClient(tokenId: bigint): JsonRpcWriteClient {
  const topic = iface.getEventTopic("AgentRegistered");
  return {
    async submitTransaction(): Promise<TransactionReceiptResult> {
      return {
        transactionHash: "0x" + "ab".repeat(32) as `0x${string}`,
        blockNumber: 100,
        logs: [
          {
            address: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319",
            data: "0x" as `0x${string}`,
            topics: [
              topic as `0x${string}`,
              `0x${tokenId.toString(16).padStart(64, "0")}` as `0x${string}`,
              "0x" + "00".repeat(32) as `0x${string}`
            ]
          }
        ]
      };
    }
  };
}

test("runRegisterCommand fails without private key", async () => {
  const originalEnv = process.env.SHENJI_CDK_PRIVATE_KEY;
  delete process.env.SHENJI_CDK_PRIVATE_KEY;
  const originalExitCode = process.exitCode;

  await runRegisterCommand({
    manifestUrl: "https://example.com/manifest.json",
    agentName: "test-agent"
  });

  assert.equal(process.exitCode, 1);
  process.exitCode = originalExitCode;
  if (originalEnv !== undefined) {
    process.env.SHENJI_CDK_PRIVATE_KEY = originalEnv;
  }
});

test("runRegisterCommand rejects stake below minimum", async () => {
  const originalEnv = process.env.SHENJI_CDK_PRIVATE_KEY;
  process.env.SHENJI_CDK_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const originalExitCode = process.exitCode;

  await runRegisterCommand({
    manifestUrl: "https://example.com/manifest.json",
    agentName: "test-agent",
    stake: "0.0001",
    fetchImpl: makeFetchForFees("1000000000000000000", "1000000000000000000")
  });

  assert.equal(process.exitCode, 1);
  process.exitCode = originalExitCode;
  if (originalEnv !== undefined) {
    process.env.SHENJI_CDK_PRIVATE_KEY = originalEnv;
  } else {
    delete process.env.SHENJI_CDK_PRIVATE_KEY;
  }
});

test("runRegisterCommand succeeds with confirmation", async () => {
  const originalEnv = process.env.SHENJI_CDK_PRIVATE_KEY;
  process.env.SHENJI_CDK_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const originalExitCode = process.exitCode;

  const input = Readable.from("y\n");

  await runRegisterCommand({
    manifestUrl: "https://example.com/manifest.json",
    agentName: "test-agent",
    fetchImpl: makeFetchForFees("100000000000000", "100000000000000"),
    writerOptions: { writeClient: makeWriteClient(42n) },
    promptOptions: { input, output: makeDevNull() }
  });

  assert.notEqual(process.exitCode, 1);
  process.exitCode = originalExitCode;
  if (originalEnv !== undefined) {
    process.env.SHENJI_CDK_PRIVATE_KEY = originalEnv;
  } else {
    delete process.env.SHENJI_CDK_PRIVATE_KEY;
  }
});
