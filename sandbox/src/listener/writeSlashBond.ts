import type { TransactionReceiptResult } from "../chain/jsonRpcWriteClient";

/**
 * 斩罚请求必须已经由政策层绑定到具体审计。tokenId/auditId 决定链上目标，amount 保持 bigint
 * 原生整数单位且不在此换算；reasonCode 通常来自封闭的 SlashReasonCode 白名单，不能携带秘密
 * 或未经审查的用户文本，因为其 bytes32 会进入公开交易数据。
 */
export interface WriteSlashBondRequest {
  tokenId: bigint;
  auditId: number;
  amount: bigint;
  reasonCode: string;
}

/**
 * 注入的提交器拥有 operator 授权、ABI 编码、nonce、广播和回执确认。本适配器不接触私钥，
 * 也不验证余额/审计状态；这些约束由 AgentAuditRegistry 在交易执行时强制。
 */
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

/**
 * 保留已经编码好的 32 字节十六进制值以兼容底层调用方；普通字符串写入零填充的 32 字节
 * UTF-8 缓冲区，不做哈希。Buffer.write 对超过容量的内容只写入可容纳前缀，因此调用方必须
 * 使用短、稳定的协议代码，不能依赖长文本的唯一性。
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
 * 该函数每次调用都会尝试产生一笔具有资金副作用的 slashBond 交易，自身没有去重、预读或重试。
 * 生产重试必须通过 retrySlashQueue 按目标 auditId 查询 status=Slashed 后再决定是否重发；提交器
 * 的错误与未知回执完整向上传播，不能在这里假定交易未上链。
 */
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
