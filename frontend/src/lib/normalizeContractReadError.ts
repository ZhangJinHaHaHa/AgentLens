/**
 * 将 ethers/合约读取失败压缩为页面可处理的稳定错误码，并从 Error、字符串或未知值中提取可展示的后备消息。
 * 归类依赖 revert 消息包含 TOKEN_NOT_FOUND、NO_AUDIT_RECORD 或 INDEX_OUT_OF_BOUNDS；其余一律 UNKNOWN，避免猜测业务状态。
 * 函数纯本地，不发 RPC、不缓存、不修改错误对象，也不决定重试；调用方可按错误码选择空态，但网络恢复策略必须在更高层实现。
 * 错误文本来自钱包/RPC 等不可信边界，只能按转义文本展示，且不能据此执行授权；合约升级若改变 reason 字符串需同步维护兼容映射。
 */
export type ContractReadErrorCode =
  | "TOKEN_NOT_FOUND"
  | "NO_AUDIT_RECORD"
  | "INDEX_OUT_OF_BOUNDS"
  | "UNKNOWN";

export function normalizeContractReadError(error: unknown): ContractReadErrorCode {
  const message = getErrorMessage(error);

  if (message.includes("TOKEN_NOT_FOUND")) {
    return "TOKEN_NOT_FOUND";
  }

  if (message.includes("NO_AUDIT_RECORD")) {
    return "NO_AUDIT_RECORD";
  }

  if (message.includes("INDEX_OUT_OF_BOUNDS")) {
    return "INDEX_OUT_OF_BOUNDS";
  }

  return "UNKNOWN";
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown contract read error.";
}
