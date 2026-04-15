import assert from "node:assert/strict";
import test from "node:test";

import { writeCompensateBond } from "../../src/listener/writeCompensateBond";

test("writeCompensateBond maps compensation arguments into compensateBond calldata arguments", async () => {
  let captured:
    | {
        method: string;
        args: {
          tokenId: bigint;
          auditId: number;
          amount: bigint;
          reasonCode: `0x${string}`;
        };
      }
    | undefined;

  const result = await writeCompensateBond(
    {
      tokenId: 1n,
      auditId: 2,
      amount: 400000000000000000n,
      reasonCode: "APPEAL_APPROVED"
    },
    {
      submitContractCall: async (request) => {
        captured = request;
        return { ok: true };
      }
    }
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(captured, {
    method: "compensateBond",
    args: {
      tokenId: 1n,
      auditId: 2,
      amount: 400000000000000000n,
      reasonCode: "0x41505045414c5f415050524f5645440000000000000000000000000000000000"
    }
  });
});
