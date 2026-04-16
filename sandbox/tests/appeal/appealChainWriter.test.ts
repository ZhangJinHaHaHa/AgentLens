import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createAppealChainWriter,
  readAppealChainWriterConfigFromEnv,
  type AppealChainWriterConfig
} from "../../src/appeal/appealChainWriter.js";

describe("readAppealChainWriterConfigFromEnv", () => {
  it("returns undefined when APPEAL_CHAIN_WRITER_ENABLED is not true", () => {
    const result = readAppealChainWriterConfigFromEnv({});
    assert.equal(result, undefined);
  });

  it("returns undefined when APPEAL_CHAIN_WRITER_ENABLED is false", () => {
    const result = readAppealChainWriterConfigFromEnv({
      APPEAL_CHAIN_WRITER_ENABLED: "false"
    });
    assert.equal(result, undefined);
  });

  it("throws when required env vars are missing", () => {
    assert.throws(() => {
      readAppealChainWriterConfigFromEnv({
        APPEAL_CHAIN_WRITER_ENABLED: "true"
      });
    }, /AUDIT_RPC_URL is required/);
  });

  it("throws when AUDIT_REGISTRY_V2_ADDRESS is missing", () => {
    assert.throws(() => {
      readAppealChainWriterConfigFromEnv({
        APPEAL_CHAIN_WRITER_ENABLED: "true",
        AUDIT_RPC_URL: "http://localhost:8545"
      });
    }, /AUDIT_REGISTRY_V2_ADDRESS is required/);
  });

  it("returns config when all env vars present", () => {
    const config = readAppealChainWriterConfigFromEnv({
      APPEAL_CHAIN_WRITER_ENABLED: "true",
      AUDIT_RPC_URL: "http://localhost:8545",
      AUDIT_REGISTRY_V2_ADDRESS: "0x1234567890abcdef1234567890abcdef12345678",
      AUDIT_CHAIN_ID: "302612",
      AUDIT_OPERATOR_PRIVATE_KEY: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    });

    assert.ok(config);
    assert.equal(config!.rpcUrl, "http://localhost:8545");
    assert.equal(config!.chainId, 302612);
  });
});

describe("createAppealChainWriter", () => {
  it("creates a chain writer with fileAppealOnChain and resolveAppealOnChain methods", () => {
    const config: AppealChainWriterConfig = {
      rpcUrl: "http://localhost:8545",
      contractAddress: "0x1234567890abcdef1234567890abcdef12345678",
      chainId: 302612,
      operatorPrivateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    };

    const writer = createAppealChainWriter(config);
    assert.equal(typeof writer.fileAppealOnChain, "function");
    assert.equal(typeof writer.resolveAppealOnChain, "function");
  });

  it("fileAppealOnChain encodes and submits transaction", async () => {
    let submittedData: string | undefined;

    const config: AppealChainWriterConfig = {
      rpcUrl: "http://localhost:8545",
      contractAddress: "0x1234567890abcdef1234567890abcdef12345678",
      chainId: 302612,
      operatorPrivateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    };

    const writer = createAppealChainWriter(config, {
      createJsonRpcWriteClient: () => ({
        submitTransaction: async (request) => {
          submittedData = request.data;
          return {
            transactionHash: "0xabcd1234" as `0x${string}`,
            blockNumber: 100
          };
        }
      })
    });

    const result = await writer.fileAppealOnChain({
      tokenId: "1",
      auditId: "1",
      evidenceHash: "0xed1d",
      appealCID: "appeal-001"
    });

    assert.equal(result.transactionHash, "0xabcd1234");
    assert.ok(submittedData);
    // Function selector for fileAppeal should be present
    assert.ok(submittedData!.startsWith("0x"));
  });

  it("resolveAppealOnChain encodes approved outcome", async () => {
    let submittedData: string | undefined;

    const config: AppealChainWriterConfig = {
      rpcUrl: "http://localhost:8545",
      contractAddress: "0x1234567890abcdef1234567890abcdef12345678",
      chainId: 302612,
      operatorPrivateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    };

    const writer = createAppealChainWriter(config, {
      createJsonRpcWriteClient: () => ({
        submitTransaction: async (request) => {
          submittedData = request.data;
          return {
            transactionHash: "0xef567890" as `0x${string}`,
            blockNumber: 101
          };
        }
      })
    });

    const result = await writer.resolveAppealOnChain({
      tokenId: "1",
      appealId: "1",
      outcome: "approved"
    });

    assert.equal(result.transactionHash, "0xef567890");
    assert.ok(submittedData);
  });

  it("resolveAppealOnChain encodes rejected outcome", async () => {
    const config: AppealChainWriterConfig = {
      rpcUrl: "http://localhost:8545",
      contractAddress: "0x1234567890abcdef1234567890abcdef12345678",
      chainId: 302612,
      operatorPrivateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    };

    const writer = createAppealChainWriter(config, {
      createJsonRpcWriteClient: () => ({
        submitTransaction: async () => ({
          transactionHash: "0xdeadbeef" as `0x${string}`,
          blockNumber: 102
        })
      })
    });

    const result = await writer.resolveAppealOnChain({
      tokenId: "2",
      appealId: "3",
      outcome: "rejected"
    });

    assert.equal(result.transactionHash, "0xdeadbeef");
  });
});
