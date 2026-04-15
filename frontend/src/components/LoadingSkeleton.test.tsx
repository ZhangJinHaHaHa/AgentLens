import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingSkeleton } from "./LoadingSkeleton";

describe("LoadingSkeleton", () => {
  it("renders with aria-busy and aria-label", () => {
    render(<LoadingSkeleton title="Loading data" />);

    const skeleton = screen.getByLabelText("Loading data");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute("aria-busy", "true");
  });

  it("renders the specified number of skeleton lines", () => {
    const { container } = render(<LoadingSkeleton lines={3} />);

    const lines = container.querySelectorAll(".skeleton-line");
    expect(lines).toHaveLength(3);
  });

  it("defaults to 4 lines", () => {
    const { container } = render(<LoadingSkeleton />);

    const lines = container.querySelectorAll(".skeleton-line");
    expect(lines).toHaveLength(4);
  });
});
