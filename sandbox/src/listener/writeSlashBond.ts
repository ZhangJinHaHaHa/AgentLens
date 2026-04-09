import type { TransactionReceiptResult } from "../chain/jsonRpcWriteClient";

export interface WriteSlashBondRequest {
  tokenId: bigint;
  auditId: number;
  amount: bigint;
  reasonCode: string;
}

export interface WriteSlashBondDependencies {
  submitContractCall: (request: {
    method: "slashBond";
    args: {
      tokenId: bigint;
      auditId: number;
      amount: bigint;
      reasonCode: `0x${string}`;
    };
  }) => Promise<TransactionReceiptResult | unknown>;
}

function normalizeReasonCode(reasonCode: string): `0x${string}` {
  if (/^0x[0-9a-fA-F]{64}$/u.test(reasonCode)) {
    return reasonCode as `0x${string}`;
  }

  const encoded = Buffer.alloc(32);
  encoded.write(reasonCode, "utf8");
  return `0x${encoded.toString("hex")}`;
}

export async function writeSlashBond(
  request: WriteSlashBondRequest,
  deps: WriteSlashBondDependencies
): Promise<unknown> {
  return deps.submitContractCall({
    method: "slashBond",
    args: {
      tokenId: request.tokenId,
      auditId: request.auditId,
      amount: request.amount,
      reasonCode: normalizeReasonCode(request.reasonCode)
    }
  });
}
