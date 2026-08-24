export type ContractReadErrorCode =
  | "TOKEN_NOT_FOUND"
  | "NO_AUDIT_RECORD"
  | "INDEX_OUT_OF_BOUNDS"
  | "UNKNOWN";

/**
 * 把 RPC/ethers 抛出的不稳定错误文本收敛为 CLI 可依赖的小型领域码集合。
 * 这是兼容适配而非真实性校验：仅识别大小写敏感的已知标记，未命中的错误必须保持 UNKNOWN，
 * 以免网络故障、节点异常或未来合约错误被误判成“记录不存在”等可忽略状态。
 */
export function normalizeContractReadError(error: unknown): ContractReadErrorCode {
  const message = getContractReadErrorMessage(error);

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

export function getContractReadErrorMessage(error: unknown): string {
  // 信任边界只接受标准 Error 或裸字符串；任意对象不读取自定义属性，避免依赖提供方私有错误形状。
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  // 固定回退文本不会泄露未知对象内容，同时保证上层分类稳定落入 UNKNOWN。
  return "Unknown contract read error.";
}
