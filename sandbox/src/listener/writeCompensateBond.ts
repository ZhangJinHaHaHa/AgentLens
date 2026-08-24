import type { TransactionReceiptResult } from "../chain/jsonRpcWriteClient";

/**
 * 补偿请求引用已经被斩罚的精确审计，amount 使用合约原生整数单位并保持 bigint 精度。本层接受
 * string 是为了兼容申诉原因码来源，但内容最终公开在 calldata 中，调用方不得传入凭据、个人
 * 数据或任意申诉正文。
 */
export interface WriteCompensateBondRequest {
  tokenId: bigint;
  auditId: number;
  amount: bigint;
  reasonCode: string;
}

/**
 * submitContractCall 是权限与链连接的信任边界：它负责 operator 签名、ABI 编码、发送及确认。
 * 适配器只做字段映射，不持久化私钥/请求，也不绕过合约对 token、audit 状态和权限的检查。
 */
export interface WriteCompensateBondDependencies {
  submitContractCall: (request: {
    method: "compensateBond";
    args: {
      tokenId: bigint;
      auditId: number;
      amount: bigint;
      reasonCode: `0x${string}`;
    };
  }) => Promise<TransactionReceiptResult | unknown>;
}

/**
 * 精确 bytes32 十六进制原因码原样传递，支持既有协议调用方；其他值以 UTF-8 写入零初始化的
 * 32 字节缓冲区。超过容量的字符串会被 Buffer.write 截为可容纳前缀而非哈希，因此原因码必须
 * 是长度受控的稳定枚举，不能把截断后的值当作长消息的唯一标识。
 */
function normalizeReasonCode(reasonCode: string): `0x${string}` {
  if (/^0x[0-9a-fA-F]{64}$/u.test(reasonCode)) {
    return reasonCode as `0x${string}`;
  }

  const encoded = Buffer.alloc(32);
  encoded.write(reasonCode, "utf8");
  return `0x${encoded.toString("hex")}`;
}

/**
 * 每次调用都直接请求 compensateBond，且不内建队列或幂等键。合约仅允许目标记录处于 Slashed，
 * 成功后会转为 Compensated 并标记 appealApproved；重复调用会由合约状态拒绝。网络超时仍可能
 * 对应已上链交易，若未来增加自动重试，必须先读取目标 auditId 的状态再重放。
 */
export async function writeCompensateBond(
  request: WriteCompensateBondRequest,
  deps: WriteCompensateBondDependencies
): Promise<unknown> {
  return deps.submitContractCall({
    method: "compensateBond",
    args: {
      tokenId: request.tokenId,
      auditId: request.auditId,
      amount: request.amount,
      reasonCode: normalizeReasonCode(request.reasonCode)
    }
  });
}
