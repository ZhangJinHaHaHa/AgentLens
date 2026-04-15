import { describe, expect, it } from "vitest";

import { parseTokenIdInput } from "./tokenId";

describe("parseTokenIdInput", () => {
  it("trims whitespace and preserves the normalized decimal string", () => {
    expect(parseTokenIdInput(" 00123 ")).toEqual({
      ok: true,
      normalized: "00123",
      value: 123n
    });
  });

  it("rejects an empty token input", () => {
    expect(parseTokenIdInput("   ")).toEqual({
      ok: false,
      error: "Token ID must be a non-empty decimal string."
    });
  });

  it("rejects non-decimal token input", () => {
    expect(parseTokenIdInput("12.3")).toEqual({
      ok: false,
      error: "Token ID must be a non-empty decimal string."
    });
  });
});
