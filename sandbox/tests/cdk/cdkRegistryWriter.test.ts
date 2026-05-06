import test from "node:test";
import assert from "node:assert/strict";

import { getCdkV2Interface } from "../../src/cdk/chain/cdkArtifact";
import { stakeAgent } from "../../src/cdk/chain/cdkRegistryWriter";
import type { JsonRpcWriteClient, TransactionReceiptResult } from "../../src/chain/jsonRpcWriteClient";

const iface = getCdkV2Interface();

function makeWriteClientMock(tokenId: bigint): JsonRpcWriteClient {
  const agentRegisteredTopic = iface.getEventTopic("AgentRegistered");
  const tokenIdHex = `0x${tokenId.toString(16).padStart(64, "0")}` as `0x${string}`;

  return {
    async submitTransaction(request): Promise<TransactionReceiptResult> {
      assert.ok(request.data.startsWith("0x"));
      assert.ok(request.value !== undefined);
      return {
        transactionHash: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as `0x${string}`,
        blockNumber: 42,
        logs: [
          {
            address: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319",
            data: iface.getEvent("AgentRegistered").format() ? "0x" as `0x${string}` : "0x" as `0x${string}`,
            topics: [
              agentRegisteredTopic as `0x${string}`,
              tokenIdHex,
              "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`
            ]
          }
        ]
      };
    }
  };
}

test("stakeAgent encodes stake calldata and extracts tokenId from logs", async () => {
  const config = {
    rpcUrl: "http://localhost:8545",
    chainId: 31337,
    registryAddress: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  };

  const result = await stakeAgent(
    { config, writeClient: makeWriteClientMock(7n) },
    "my-agent",
    "https://example.com/manifest.json",
    1000000000000000000n
  );

  assert.equal(result.tokenId, 7n);
  assert.equal(result.transactionHash, "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
  assert.equal(result.blockNumber, 42);
});

test("stakeAgent throws when AgentRegistered event missing", async () => {
  const emptyLogClient: JsonRpcWriteClient = {
    async submitTransaction(): Promise<TransactionReceiptResult> {
      return {
        transactionHash: "0xaaaa" as `0x${string}`,
        blockNumber: 1,
        logs: []
      };
    }
  };

  const config = {
    rpcUrl: "http://localhost:8545",
    chainId: 31337,
    registryAddress: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  };

  await assert.rejects(
    () =>
      stakeAgent(
        { config, writeClient: emptyLogClient },
        "test",
        "https://example.com/m.json",
        1n
      ),
    { message: /AgentRegistered event not found/ }
  );
});

test("stakeAgent throws when privateKey is missing and no writeClient", async () => {
  const config = {
    rpcUrl: "http://localhost:8545",
    chainId: 31337,
    registryAddress: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319"
  };

  await assert.rejects(
    () =>
      stakeAgent(
        { config },
        "test",
        "https://example.com/m.json",
        1n
      ),
    { message: /privateKey is required/ }
  );
});
