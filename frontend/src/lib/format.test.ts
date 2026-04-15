import { describe, expect, it } from "vitest";

import { formatTimestamp, truncateAddress, formatBondWei } from "./format";

describe("formatTimestamp", () => {
  it("formats a valid unix timestamp", () => {
    const result = formatTimestamp(1700000000);
    expect(result).toBeTruthy();
    expect(result).not.toBe("Unknown");
  });

  it("formats a bigint timestamp", () => {
    const result = formatTimestamp(1700000000n);
    expect(result).toBeTruthy();
    expect(result).not.toBe("Unknown");
  });

  it("returns Unknown for zero", () => {
    expect(formatTimestamp(0)).toBe("Unknown");
  });

  it("returns Unknown for negative values", () => {
    expect(formatTimestamp(-1)).toBe("Unknown");
  });
});

describe("truncateAddress", () => {
  it("truncates a long address", () => {
    const address = "0x1111111111111111111111111111111111111111";
    const result = truncateAddress(address);
    expect(result).toBe("0x1111...1111");
  });

  it("does not truncate a short string", () => {
    expect(truncateAddress("0x1234")).toBe("0x1234");
  });

  it("supports custom leading and trailing character counts", () => {
    const address = "0x1111111111111111111111111111111111111111";
    expect(truncateAddress(address, 10, 6)).toBe("0x11111111...111111");
  });
});

describe("formatBondWei", () => {
  it("formats a large bond as ETH", () => {
    expect(formatBondWei(1000000000000000000n)).toBe("1.0000 ETH");
  });

  it("formats a small bond as wei", () => {
    expect(formatBondWei(999n)).toBe("999 wei");
  });

  it("formats zero as wei", () => {
    expect(formatBondWei(0n)).toBe("0 wei");
  });
});
