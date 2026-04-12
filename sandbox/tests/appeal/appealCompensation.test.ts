import assert from "node:assert/strict";
import test from "node:test";

import {
  createAppealCompensationExecutor,
  readAppealCompensationConfigFromEnv
} from "../../src/appeal/appealCompensation";
import type { TransactionReceiptResult } from "../../src/chain/jsonRpcWriteClient";
import type { WriteCompensateBondRequest } from "../../src/listener/writeCompensateBond";

const completeEnv = {
  AUDIT_APPEAL_COMPENSATION_ENABLED: "true",
  AUDIT_RPC_URL: "https://rpc.example",
  AUDIT_REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111",
  AUDIT_CHAIN_ID: "31337",
  AUDIT_OPERATOR_PRIVATE_KEY: `0x${"11".repeat(32)}`
};

test("readAppealCompensationConfigFromEnv returns undefined when compensation is disabled", () => {
  assert.equal(readAppealCompensationConfigFromEnv({}), undefined);
  assert.equal(
    readAppealCompensationConfigFromEnv({
      ...completeEnv,
      AUDIT_APPEAL_COMPENSATION_ENABLED: "false"
    }),
    undefined
  );
});

test("readAppealCompensationConfigFromEnv rejects partial enabled configuration", () => {
  assert.throws(
    () =>
      readAppealCompensationConfigFromEnv({
        AUDIT_APPEAL_COMPENSATION_ENABLED: "true",
        AUDIT_RPC_URL: "https://rpc.example"
      }),
    /AUDIT_REGISTRY_ADDRESS is required/
  );
});

test("createAppealCompensationExecutor submits compensateBond and returns the transaction hash", async () => {
  let capturedConfig:
    | {
        rpcUrl: string;
        chainId: number;
        privateKey: string;
      }
    | undefined;
  let capturedRequest: WriteCompensateBondRequest | undefined;

  const executor = createAppealCompensationExecutor(
    readAppealCompensationConfigFromEnv(completeEnv)!,
    {
      createJsonRpcWriteClient: (config) => {
        capturedConfig = config;
        return {
          submitTransaction: async () =>
            ({
              transactionHash: "0xcompensated",
              blockNumber: 123
            }) satisfies TransactionReceiptResult
        };
      },
      writeCompensateBond: async (request) => {
        capturedRequest = request;
        return {
          transactionHash: "0xcompensated",
          blockNumber: 123
        };
      }
    }
  );

  const result = await executor({
    tokenId: "1",
    auditId: "2",
    amount: "400000000000000000",
    reasonCode: "APPEAL_APPROVED"
  });

  assert.deepEqual(capturedConfig, {
    rpcUrl: "https://rpc.example",
    chainId: 31337,
    privateKey: `0x${"11".repeat(32)}`
  });
  assert.deepEqual(capturedRequest, {
    tokenId: 1n,
    auditId: 2,
    amount: 400000000000000000n,
    reasonCode: "APPEAL_APPROVED"
  });
  assert.deepEqual(result, {
    transactionHash: "0xcompensated"
  });
});
