import test from "node:test";
import assert from "node:assert/strict";

import { utils } from "ethers";

import { writeSlashBond } from "../../src/listener/writeSlashBond";

test("writeSlashBond maps slash arguments into slashBond calldata arguments", async () => {
  const captured: unknown[] = [];
  const submitResult = { transactionHash: "0xabc", blockNumber: 123 };

  const result = await writeSlashBond(
    {
      tokenId: 1n,
      auditId: 3,
      amount: 1000000000000000000n,
      reasonCode: "ACTION_MISMATCH"
    },
    {
      submitContractCall: async (
        request: { method: string; args: Record<string, unknown> }
      ) => {
        captured.push(request);
        return submitResult;
      }
    }
  );

  assert.deepEqual(result, submitResult);
  assert.deepEqual(captured, [
    {
      method: "slashBond",
      args: {
        tokenId: 1n,
        auditId: 3,
        amount: 1000000000000000000n,
        reasonCode: utils.formatBytes32String("ACTION_MISMATCH")
      }
    }
  ]);
});

test("writeSlashBond preserves pre-encoded bytes32 reason codes", async () => {
  const captured: unknown[] = [];
  const preencodedReason = `0x${"7".repeat(64)}`;

  await writeSlashBond(
    {
      tokenId: 9n,
      auditId: 1,
      amount: 0n,
      reasonCode: preencodedReason
    },
    {
      submitContractCall: async (
        request: { method: string; args: Record<string, unknown> }
      ) => {
        captured.push(request);
        return { transactionHash: "0xdef", blockNumber: 222 };
      }
    }
  );

  assert.deepEqual(captured, [
    {
      method: "slashBond",
      args: {
        tokenId: 9n,
        auditId: 1,
        amount: 0n,
        reasonCode: preencodedReason
      }
    }
  ]);
});
