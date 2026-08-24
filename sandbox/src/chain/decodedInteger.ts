/**
 * 将 ABI 解码结果收敛为 JavaScript `number`。
 *
 * ethers 不同主版本以及测试替身可能分别返回 number、bigint、十进制字符串或旧版
 * BigNumber；这里是这些表示法进入业务层前的兼容边界。业务字段一旦超过安全整数范围就
 * 必须改走 bigint，不能通过舍入继续执行，否则链上标识、计数或时间戳会在无提示的情况下失真。
 */
export function decodedIntegerToNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "bigint"
      ? Number(value)
      : typeof value === "string" && /^-?\d+$/u.test(value)
        ? Number(value)
        : readLegacyNumber(value);
  if (!Number.isSafeInteger(parsed)) {
    // label 来自调用方的字段名，仅用于保留错误上下文；失败值本身不拼入消息，避免日志带出不可信对象。
    throw new Error(`${label} is not a safe integer.`);
  }
  return parsed;
}

/**
 * 将不受 `Number.MAX_SAFE_INTEGER` 限制的链上整数规范化为 bigint。
 * 字符串只接受完整十进制整数，避免 `BigInt` 对空白、进制前缀等宽松输入形成隐式兼容合同。
 */
export function decodedIntegerToBigInt(value: unknown, label: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/u.test(value)) return BigInt(value);
  if (isRecord(value) && typeof value.toBigInt === "function") {
    // 先采用 ethers v6 风格的显式转换，并再次核对返回类型，不能信任任意对象伪造的方法签名。
    const parsed = value.toBigInt();
    if (typeof parsed === "bigint") return parsed;
  }
  if (isRecord(value) && typeof value.toString === "function") {
    // toString 是旧解码器/BigNumber 的最后兼容通道；正则校验阻止科学计数法和非整数字符串进入链上计算。
    const rendered = value.toString();
    if (/^-?\d+$/u.test(rendered)) return BigInt(rendered);
  }
  throw new Error(`${label} is not an integer.`);
}

// 旧版 BigNumber 的 toNumber 可能因溢出而抛错；该错误应原样越过本边界，交由上层中止当前读取。
function readLegacyNumber(value: unknown): number {
  if (isRecord(value) && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number.NaN;
}

// 只在调用兼容方法前排除 null；本检查不把对象视为可信数据，也不承担 ABI 结构校验。
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
