import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EvidenceInfo } from "./EvidenceInfo";

describe("EvidenceInfo", () => {
  it("renders all evidence fields", () => {
    render(
      <EvidenceInfo
        reportHash="0xaabbcc"
        reportCID="bafy-test"
        manifestHash="0xddeeff"
        manifestUrl="https://example.com/manifest.json"
        hashVerified={true}
        sourceUrl="https://gateway.example/ipfs/bafy-test"
      />
    );

    expect(screen.getByRole("heading", { name: /evidence information/i })).toBeInTheDocument();
    expect(screen.getByText("0xaabbcc")).toBeInTheDocument();
    expect(screen.getByText("bafy-test")).toBeInTheDocument();
    expect(screen.getByText("0xddeeff")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/manifest.json")).toBeInTheDocument();
    expect(screen.getByText("https://gateway.example/ipfs/bafy-test")).toBeInTheDocument();
  });

  it("shows Hash verified badge when hashVerified is true", () => {
    render(
      <EvidenceInfo
        reportHash="0xaabbcc"
        reportCID="bafy-test"
        manifestHash="0xddeeff"
        manifestUrl="https://example.com/manifest.json"
        hashVerified={true}
      />
    );

    expect(screen.getByText("Hash verified")).toBeInTheDocument();
  });

  it("shows Hash not verified badge when hashVerified is false", () => {
    render(
      <EvidenceInfo
        reportHash="0xaabbcc"
        reportCID="bafy-test"
        manifestHash="0xddeeff"
        manifestUrl="https://example.com/manifest.json"
        hashVerified={false}
      />
    );

    expect(screen.getByText("Hash not verified")).toBeInTheDocument();
  });

  it("shows Not available for missing fields", () => {
    render(
      <EvidenceInfo
        reportHash=""
        reportCID=""
        manifestHash=""
        manifestUrl=""
        hashVerified={false}
      />
    );

    const notAvailable = screen.getAllByText("Not available");
    expect(notAvailable.length).toBeGreaterThanOrEqual(4);
  });
});
