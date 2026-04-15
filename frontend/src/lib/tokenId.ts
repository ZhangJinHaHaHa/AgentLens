export type TokenIdParseResult =
  | {
      ok: true;
      normalized: string;
      value: bigint;
    }
  | {
      ok: false;
      error: string;
    };

const TOKEN_ID_ERROR = "Token ID must be a non-empty decimal string.";

export function parseTokenIdInput(input: string): TokenIdParseResult {
  const normalized = input.trim();

  if (!/^\d+$/.test(normalized)) {
    return {
      ok: false,
      error: TOKEN_ID_ERROR
    };
  }

  return {
    ok: true,
    normalized,
    value: BigInt(normalized)
  };
}
