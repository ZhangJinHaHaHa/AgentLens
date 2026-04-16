import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AttestationBadge, isAttestationPresent } from "./AttestationBadge";

describe("isAttestationPresent", () => {
  it("returns false for undefined/null/empty", () => {
    expect(isAttestationPresent(undefined)).toBe(false);
    expect(isAttestationPresent(null)).toBe(false);
    expect(isAttestationPresent("")).toBe(false);
    expect(isAttestationPresent("   ")).toBe(false);
  });

  it("returns false for the canonical zero hash (with and without 0x prefix)", () => {
    const zero = "0x" + "0".repeat(64);
    expect(isAttestationPresent(zero)).toBe(false);
    expect(isAttestationPresent("0".repeat(64))).toBe(false);
  });

  it("returns true for a non-zero hash", () => {
    expect(isAttestationPresent("0x" + "a".repeat(64))).toBe(true);
    expect(isAttestationPresent("0x1234")).toBe(true);
  });
});

describe("AttestationBadge", () => {
  it("shows 'Not attested' when hash is zero", () => {
    render(<AttestationBadge attestationHash={"0x" + "0".repeat(64)} />);
    expect(screen.getByText("Not attested")).toBeInTheDocument();
  });

  it("shows the verified label + shortened hash for a real hash", () => {
    const hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    render(<AttestationBadge attestationHash={hash} />);
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
    expect(screen.getByText(/0x1234…cdef/)).toBeInTheDocument();
  });

  it("renders a custom label when provided", () => {
    render(
      <AttestationBadge
        attestationHash={"0x" + "a".repeat(64)}
        label="Custom label"
      />
    );
    expect(screen.getByText("Custom label")).toBeInTheDocument();
  });
});
