export function decodedIntegerToNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "bigint"
      ? Number(value)
      : typeof value === "string" && /^-?\d+$/u.test(value)
        ? Number(value)
        : readLegacyNumber(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} is not a safe integer.`);
  }
  return parsed;
}

export function decodedIntegerToBigInt(value: unknown, label: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/u.test(value)) return BigInt(value);
  if (isRecord(value) && typeof value.toBigInt === "function") {
    const parsed = value.toBigInt();
    if (typeof parsed === "bigint") return parsed;
  }
  if (isRecord(value) && typeof value.toString === "function") {
    const rendered = value.toString();
    if (/^-?\d+$/u.test(rendered)) return BigInt(rendered);
  }
  throw new Error(`${label} is not an integer.`);
}

function readLegacyNumber(value: unknown): number {
  if (isRecord(value) && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number.NaN;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
