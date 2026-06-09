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
