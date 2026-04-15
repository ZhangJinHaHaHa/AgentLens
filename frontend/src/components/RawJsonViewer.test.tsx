import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RawJsonViewer } from "./RawJsonViewer";

describe("RawJsonViewer", () => {
  it("renders a collapsed toggle by default", () => {
    render(<RawJsonViewer json='{"key": "value"}' />);

    expect(screen.getByText("Raw JSON")).toBeInTheDocument();
    expect(screen.getByText("Expand")).toBeInTheDocument();
    expect(screen.queryByText('"key"')).not.toBeInTheDocument();
  });

  it("expands to show JSON content when clicked", () => {
    render(<RawJsonViewer json='{"key": "value"}' />);

    fireEvent.click(screen.getByText("Expand"));

    expect(screen.getByText("Collapse")).toBeInTheDocument();
    expect(screen.getByText(/\"key\"/)).toBeInTheDocument();
  });

  it("collapses back when clicked again", () => {
    render(<RawJsonViewer json='{"key": "value"}' />);

    fireEvent.click(screen.getByText("Expand"));
    fireEvent.click(screen.getByText("Collapse"));

    expect(screen.getByText("Expand")).toBeInTheDocument();
    expect(screen.queryByText(/\"key\"/)).not.toBeInTheDocument();
  });

  it("uses a custom title", () => {
    render(<RawJsonViewer json="{}" title="Report data" />);

    expect(screen.getByText("Report data")).toBeInTheDocument();
  });

  it("has correct aria-expanded attributes", () => {
    render(<RawJsonViewer json="{}" />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
