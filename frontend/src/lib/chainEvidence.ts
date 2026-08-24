/**
 * 识别链证据字段是否不是 bytes32 零值：输入可空字符串，输出类型收窄布尔值，并兼容空白、`0x` 前缀和大小写差异。
 * 判断仅做本地规范化，不联网、不缓存、不抛错也不重试；全零哨兵是旧审计/模拟路径“无证明”的兼容表示。
 * 本函数不校验十六进制格式、固定长度、哈希原文或签名来源，非零只代表字段存在，绝不能作为证明或 attestation 已验证的安全结论。
 */
const ZERO_HASH = "0".repeat(64);

function normalizeHash(value: string): string {
  return value.trim().replace(/^0x/i, "").toLowerCase();
}

export function isNonZeroHash(value: string | undefined | null): value is string {
  if (typeof value !== "string") return false;

  const normalized = normalizeHash(value);
  return normalized.length > 0 && normalized !== ZERO_HASH;
}

export function isAttestationPresent(attestationHash: string | undefined | null): boolean {
  return isNonZeroHash(attestationHash);
}
